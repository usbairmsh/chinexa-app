export interface InstagramPost {
  id: string;
  image: string;
  link: string;
}

export interface InstagramFeedContent {
  handle: string;
  posts: InstagramPost[];
}
