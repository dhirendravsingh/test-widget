const StoryFeedSkeleton = () => {
  return (
    <div className="ins-story-skeleton-feed">
      {new Array(6).fill(null).map((_, index) => (
        <div key={index} className="ins-story-skeleton-item">
          <div className="ins-story-skeleton-circle">
            <div className="ins-story-skeleton-gradient-ring">
              <div className="ins-story-skeleton-inner-circle"></div>
            </div>
          </div>
          <div className="ins-story-skeleton-text"></div>
        </div>
      ))}
    </div>
  );
};

export default StoryFeedSkeleton;
