import { readFile } from "node:fs/promises";
import { getValidToken } from "./token-store.js";

const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";
const ASSETS_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";
const PROFILE_URL = "https://api.linkedin.com/v2/userinfo";
const ME_URL = "https://api.linkedin.com/v2/me";
const SOCIAL_ACTIONS_URL = "https://api.linkedin.com/v2/socialActions";

type Visibility = "PUBLIC" | "CONNECTIONS";

export interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
  warning?: string;
}

async function getAuth(): Promise<{
  token: string;
  personUrn?: string; // Made optional since we can't always fetch it
  warning?: string;
} | null> {
  return getValidToken();
}

function linkedInHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/**
 * Post a text-only update to LinkedIn.
 */
export async function postText(
  text: string,
  visibility: Visibility = "PUBLIC",
): Promise<PostResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      success: false,
      error: "Not authenticated. Run `openclaw linkedin-auth` first.",
    };
  }

  // Build body - only include author field if we have a valid person URN
  // LinkedIn will infer the author from the authenticated token if omitted
  const body: Record<string, unknown> = {
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  // Only add author field if we have it and it's not a placeholder
  if (auth.personUrn && !auth.personUrn.startsWith('unknown')) {
    body.author = auth.personUrn;
  }

  const res = await fetch(UGC_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `LinkedIn API error (${res.status}): ${errBody}` };
  }

  const postId = res.headers.get("X-RestLi-Id") ?? undefined;
  return { success: true, postId, warning: auth.warning };
}

/**
 * Share an article/URL on LinkedIn with optional commentary.
 */
export async function postArticle(
  text: string,
  url: string,
  title?: string,
  description?: string,
  visibility: Visibility = "PUBLIC",
): Promise<PostResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      success: false,
      error: "Not authenticated. Run `openclaw linkedin-auth` first.",
    };
  }

  const media: Record<string, unknown> = {
    status: "READY",
    originalUrl: url,
  };
  if (title) media.title = { text: title };
  if (description) media.description = { text: description };

  // Build body - only include author if we have it
  const body: Record<string, unknown> = {
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "ARTICLE",
        media: [media],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  if (auth.personUrn && !auth.personUrn.startsWith('unknown')) {
    body.author = auth.personUrn;
  }

  const res = await fetch(UGC_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `LinkedIn API error (${res.status}): ${errBody}` };
  }

  const postId = res.headers.get("X-RestLi-Id") ?? undefined;
  return { success: true, postId, warning: auth.warning };
}

/**
 * Post an image with optional caption to LinkedIn.
 */
export async function postImage(
  text: string,
  imagePath: string,
  visibility: Visibility = "PUBLIC",
): Promise<PostResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      success: false,
      error: "Not authenticated. Run `openclaw linkedin-auth` first.",
    };
  }

  // Read image
  const imageBuffer = await readFile(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  // Build body
  const body: Record<string, unknown> = {
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: [
          {
            "description": {
              "text": text,
            },
            "mediaType": "staticimage",
            "status": "READY",
          },
          {
            "description": {
              "altText": "image",
            },
            "mediaType": "staticimage:alttext",
            "binaryContent": imageBase64,
            "fileFormat": "JPEG",
            "dimensions": {
              "height": 1080,
              "width": 1920,
            },
            "status": "READY",
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": visibility,
    },
  };

  // Only include author if we have it
  if (auth.personUrn && !auth.personUrn.startsWith('unknown')) {
    body.author = auth.personUrn;
  }

  // First, register the image upload
  const registerRes = await fetch(ASSETS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify({ registerUploadRequest: { ...media, ...media[0] } }),
  });

  if (!registerRes.ok) {
    const errBody = await registerRes.text();
    return { success: false, error: `LinkedIn API error (${registerRes.status}): ${errBody}` };
  }

  const asset = await registerRes.json();

  // Second, create the UGC post
  const postRes = await fetch(UGC_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(auth.token),
    body: JSON.stringify({
      ...body,
      specificContent: {
        ...body.specificContent,
        media: [asset.value],
      },
    }),
  });

  if (!postRes.ok) {
    const errBody = await postRes.text();
    return { success: false, error: `LinkedIn API error (${postRes.status}): ${errBody}` };
  }

  const postId = postRes.headers.get("X-RestLi-Id") ?? undefined;
  return { success: true, postId, warning: auth.warning };
}

// ============================================================================
// READING FUNCTIONS
// ============================================================================

export interface ProfileInfo {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
}

export interface EngagementStats {
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
}

export interface CommentInfo {
  id: string;
  text: string;
  authorName: string;
  authorHeadline?: string;
  createdAt: number;
  likes: number;
}

export interface PostInfo {
  id: string;
  text: string;
  createdAt: number;
  visibility: string;
  engagement: EngagementStats;
  comments?: CommentInfo[];
}

/**
 * Get your LinkedIn profile information.
 */
export async function getProfile(): Promise<{ success: boolean; profile?: ProfileInfo; error?: string }> {
  const auth = await getAuth();
  if (!auth) {
    return { success: false, error: "Not authenticated. Run `openclaw linkedin-auth` first." };
  }

  const res = await fetch(PROFILE_URL, {
    headers: linkedInHeaders(auth.token),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `Profile fetch failed (${res.status}): ${errBody}` };
  }

  const data = (await res.json()) as {
    sub: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    picture?: string;
  };

  return {
    success: true,
    profile: {
      id: data.sub,
      firstName: data.given_name || data.name?.split(" ")[0] || "",
      lastName: data.family_name || data.name?.split(" ").slice(1).join(" ") || "",
      profilePicture: data.picture,
    },
  };
}

/**
 * Get your recent posts with engagement data.
 * Note: LinkedIn API requires pagination - returns up to 10 posts by default.
 */
export async function getMyPosts(
  count: number = 10,
): Promise<{ success: boolean; posts?: PostInfo[]; error?: string }> {
  const auth = await getAuth();
  if (!auth) {
    return { success: false, error: "Not authenticated. Run `openclaw linkedin-auth` first." };
  }

  // LinkedIn requires author URN to fetch posts
  if (!auth.personUrn || auth.personUrn.startsWith("unknown")) {
    return { success: false, error: "Cannot fetch posts without valid person URN." };
  }

  // Build the URL with query params
  const url = new URL(UGC_POSTS_URL);
  url.searchParams.set("q", "authors");
  url.searchParams.set("authors", "List(" + encodeURIComponent(auth.personUrn) + ")");
  url.searchParams.set("count", String(count));

  const res = await fetch(url.toString(), {
    headers: linkedInHeaders(auth.token),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `Posts fetch failed (${res.status}): ${errBody}` };
  }

  const data = (await res.json()) as {
    elements?: Array<{
      id: string;
      specificContent?: {
        "com.linkedin.ugc.ShareContent"?: {
          shareCommentary?: { text?: string };
        };
      };
      created?: { time?: number };
      lifecycleState?: string;
      visibility?: { "com.linkedin.ugc.MemberNetworkVisibility"?: string };
    }>;
  };

  const posts: PostInfo[] = (data.elements || []).map((post) => ({
    id: post.id,
    text: post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "",
    createdAt: post.created?.time || 0,
    visibility: post.visibility?.["com.linkedin.ugc.MemberNetworkVisibility"] || "PUBLIC",
    engagement: { likes: 0, comments: 0, shares: 0 }, // Will be fetched separately
  }));

  return { success: true, posts };
}

/**
 * Get engagement (likes, comments) for a specific post.
 */
export async function getPostEngagement(
  postUrn: string,
): Promise<{ success: boolean; engagement?: EngagementStats; comments?: CommentInfo[]; error?: string }> {
  const auth = await getAuth();
  if (!auth) {
    return { success: false, error: "Not authenticated. Run `openclaw linkedin-auth` first." };
  }

  // Fetch social actions (likes, comments summary)
  const socialUrl = `${SOCIAL_ACTIONS_URL}/${encodeURIComponent(postUrn)}`;
  const socialRes = await fetch(socialUrl, {
    headers: linkedInHeaders(auth.token),
  });

  let engagement: EngagementStats = { likes: 0, comments: 0, shares: 0 };

  if (socialRes.ok) {
    const socialData = (await socialRes.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalComments?: number };
      sharesSummary?: { totalShares?: number };
    };
    engagement = {
      likes: socialData.likesSummary?.totalLikes || 0,
      comments: socialData.commentsSummary?.totalComments || 0,
      shares: socialData.sharesSummary?.totalShares || 0,
    };
  }

  // Fetch comments (first page)
  const commentsUrl = `${SOCIAL_ACTIONS_URL}/${encodeURIComponent(postUrn)}/comments`;
  const commentsRes = await fetch(commentsUrl, {
    headers: linkedInHeaders(auth.token),
  });

  let comments: CommentInfo[] = [];

  if (commentsRes.ok) {
    const commentsData = (await commentsRes.json()) as {
      elements?: Array<{
        id: string;
        message?: { text?: string };
        actor?: { name?: string; headline?: string };
        created?: { time?: number };
        likesSummary?: { totalLikes?: number };
      }>;
    };

    comments = (commentsData.elements || []).map((c) => ({
      id: c.id,
      text: c.message?.text || "",
      authorName: c.actor?.name || "Unknown",
      authorHeadline: c.actor?.headline,
      createdAt: c.created?.time || 0,
      likes: c.likesSummary?.totalLikes || 0,
    }));
  }

  return { success: true, engagement, comments };
}
