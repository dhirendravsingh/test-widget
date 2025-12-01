import { getSkeletonLength } from "../../lib/utils";

const ShoppableReelsFeedSkeleton = () => {
  const skeletonLength = getSkeletonLength();
  return (
    <div className="ins-svr-skeleton-feed">
      {new Array(skeletonLength).fill(null).map((_) => (
        <div className="ins-svr-skeleton-feed-card">
          <div className="ins-svr-skeleton-feed-card-video"></div>
          <div className="ins-svr-skeleton-feed-card-product">
            <div className="ins-svr-skeleton-feed-card-product-image"></div>
            <div className="ins-svr-skeleton-feed-card-product-name"></div>
            <div className="ins-svr-skeleton-feed-card-product-price"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShoppableReelsFeedSkeleton;
