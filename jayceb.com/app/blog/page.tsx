import PostsClient from "@/components/posts-csr";
import { getAllPosts } from "@/lib/get-posts";

export default function PostsPage() {
  const posts = getAllPosts();

  return <PostsClient posts={posts} />;
}
