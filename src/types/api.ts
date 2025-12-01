// Common Types

export type CountryPrice = {
  pr: number; // Price
  cs: number; // CompareAtPrice (note this is "cs" not "ca" to match the Go struct)
  cc: string; // CurrencyCode
};

export type ProductVariant = {
  pi: string; // providerVariantId
  v: string; // variation
  pr: number; // price
  c: number; // comparePrice
  s: number; // stock
  sk: string; // sku
  im: string; // image
  af: boolean; // availableForSale
  ip: string; // inventoryPolicy
  cp?: Record<string, CountryPrice>;
};

export type ProductOption = {
  n: string; // name
  v: string[]; // values
};

export type Product = {
  i: string; // productId
  p: string; // permalink
  h: string; // handle
  im: string; // image
  pi: string; // providerProductId
  t: string; // title
  d: string; // description
  v: ProductVariant[]; // variants
  o: ProductOption[]; // options
  pr: number; // price
  c: number; // comparePrice
  vi: string; // variant-id
  cp?: Record<string, CountryPrice>;
};

export type Media = {
  s: string; // size
  h: number; // height
  w: number; // width
  t: string; // thumbnailUrl
  v: string; // videoUrl
};

export type CustomCTA = {
  cn: string; // customCTAName
  cl: string; // customCTALink
};

export type ShortVideo = {
  i: string; // id
  c: bigint; // createdAt
  t: string; // title
  s: string; // subtitle
  a: boolean; // isActive
  v: number; // viewsCount
  o: number; // positionOrder
  p: Product[]; // products
  m: Media[]; // medias
  ct?: CustomCTA; // customCTA
  b?: number; // behavior
};

export type CarouselVideos = {
  i: string;
  n: string;
  v: ShortVideo[];
};

export type Story = {
  i: string; // id
  t: string; // title
  tu: string; // thumbnail
  sv: ShortVideo[]; // shortVideos
};

// Routes Response
export type GetShortVideosResponse = {
  v: ShortVideo[]; // videos
  cd: "one" | "two" | "three" | "four" | "custom"; // cardDesign
  pa: "popUp" | "pdp" | "customCode"; // purchaseFlowAction
  cc: string | null; // customCode
  hp: boolean; // hidePoweredBy
  cs: string; // customCss
  ac: string; // aiCss
  pe: boolean; // pipEnabled
  pt: string; // productPageTitle
  nv: number; // noOfVideosInViewPort,
  dp: string; // defaultPopUpVideo
  c: CarouselVideos[]; // Carousels (for homepage)
  ga: boolean; // GoogleAnalytics
  gt: boolean; // UseGtmForAnalytics
  ce: boolean; // ComparePriceEnabled
  vp: string; // VideoPlayerView
  ca: boolean; // CleverTapAnalytics
  ct: string; // CarouselTitle
  so: boolean; // ShowOldVideoPip
  st: string; // ShopNowText
  ck: string; // CustomScript
  at: string; // AddToCartButtonText
  mr: boolean; // MetaRetargeting
  de: boolean; // Discountbadge
  da: boolean; // DisplayAllProductImagesEnabled
  sa: string; // StoreFrontAccess
  vs: boolean; // VariantSliderEnabled
  fd: FrameDesign; // FrameDesign
};

export type FrameDesign = "NONE" | "CIRCLE" | "DIAMOND" | "SEMI_CIRCLE";
export type GetViewerTokenResponse = {
  vt: string; // viewerToken
};

export type GetVideoPopRestResponse = {
  sv: ShortVideo;
  cs: string;
  ac: string;
  pa: "popUp" | "pdp" | "customCode";
  ga: boolean; //GoogleAnalytics
  gt: boolean; //UseGtmForAnalytics
  so: boolean;
  ca: boolean; //CleverTapAnalytics
  cp: boolean;
  es: boolean; // EnableStoryModeOnClose
  ck: string; // customScript
  mr: boolean; //MetaRetargeting
  v: ShortVideo[];
  st: boolean; // ShowTaggedVideosForPip
  db: boolean; // Discountbadge
  da: boolean; // DisplayAllProductImagesEnabled
  ce: boolean; // ComparePriceEnable
  sa: string; // StoreFrontAccess
};

export type GetProductDetailsResponse = {
  product: Product;
};

export type GetShortVideosRequestBody = {
  originFqdn: string;
  viewerToken?: string;
  pageType: "home" | "product" | "collection";
  currentProductId?: string;
  currentCollectionId?: string;
};

export type SVBoronEventType =
  | "addToCart"
  | "shortVideoView"
  | "shortVideoImpression"
  | "shortVideoClick"
  | "newSession"
  | "closePip";

export type SVBoronAddToCartEvent = {
  productId: string;
  quantity: number;
  providerCartId: string;
  shortVideoId: string;
  variantId: string;
  orderAttributionToken: string;
};
export type SVBoronViewEvent = {
  shortVideoId: string;
};

export type VideoViewQueueItem = {
  views: number;
  metadata: {
    lastViewed: number;
  };
};

export type VideoViewsQueue = Record<string, VideoViewQueueItem>;

export type EmbedKind =
  | "carousel"
  | "story"
  | "videoPop"
  | "highlight"
  | "videoBanner";

export type ShortVideosBoronRequestBody = {
  addToCart?: SVBoronAddToCartEvent;
  shortVideoView?: SVBoronViewEvent;
  eventType: SVBoronEventType;
  videoViewsQueue?: VideoViewsQueue;
  source: EmbedKind;
  newSession?: string;
  pageId?: string;
  pageType?: string;
};

export type ShortVideosBoronResponse = {};

export type GetStoriesRequestBody = {
  originFqdn: string;
  viewerToken?: string;
  pageType: "home" | "product" | "collection";
  pageId: string;
};

export type GetStoryReelsResponse = {
  ss: StorySection[]; // story sections
  pf: "popUp" | "pdp" | "customCode"; // purchaseFlowAction
  cs: string | null; // customCss
  ga: boolean; // googleAnalytics
  gt: boolean; // useGtmForAnalytics
  ca: boolean; // clevertapAnalytics
  st: string; // shopNowText
  mr: boolean; // metaretargeting
  db: boolean; // Discountbadge
  da: boolean; // DisplayAllProductImagesEnabled
  ce: boolean; // ComparePriceEnabled
  sa: string; // StoreFrontAccess
  stt: string; // storyTitleText
};

export type StorySection = {
  n: string; // name
  s: Story[]; // stories
};

export type GetHighlightsResponse = {
  hs: HighlightSection[]; // highlight sections
  pf: "popUp" | "pdp" | "customCode"; // purchase flow
  ga: boolean; // google analytics enabled
  gt: boolean; // use gtm for analytics
  ca: boolean; // clevertap analytics enabled
  cs: string | null; // custom css
  mr: boolean; // metaretargeting
};

export type HighlightSection = {
  n: string; // name
  h: ImageHighlight[]; // highlights
};

export type ImageHighlight = {
  i: string; // id
  t: string; // title
  tu: string; // thumbnail
  ru: string; // redirection URL
};

export interface GetHighlightsParams {
  originFqdn: string;
  pageType: "home" | "product" | "collection";
  pageId: string;
}

export interface GetVideosExistParams {
  originFqdn: string;
  pageType: "home" | "product" | "collection";
  currentProductId?: string;
  currentCollectionId?: string;
  carouselName?: string;
}

export interface GetStoriesExistParams {
  originFqdn: string;
  pageType: "home" | "product" | "collection" | "customPage";
  pageId?: string;
  isHighlight?: boolean;
  customPageRoute: string;
}

// video-banner-types.ts
export type GetVideoBannersResponse = {
  b: VideoBanner[]; // banners
  cs: string; // customCss
  ac: string; // aiCss
  ga: boolean; // GoogleAnalytics
  gt: boolean; // UseGtmForAnalytics
  ca: boolean; // CleverTapAnalytics
  ck: string; // CustomScript
  mr: boolean; // MetaReTarget
};

export interface VideoBanner {
  i: string; // Banner ID
  n: string; // Banner Name
  pt: string; // Page Type
  ri: string; // Resource ID
  v: ShortVideo[]; // Videos
}
export interface GetVideoBannersExistParams {
  originFqdn: string;
  pageType: "home" | "product" | "collection";
  currentProductId?: string;
  currentCollectionId?: string;
}
