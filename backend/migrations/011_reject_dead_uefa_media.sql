-- These UEFA media URLs were verified by the media staging job as HTTP 404.
-- They are invalid candidates, not unresolved licensing decisions, so keep
-- them in the audit trail as rejected and prevent repeated retries.
UPDATE image_assets
SET review_status = 'rejected',
    is_primary = FALSE,
    metadata = metadata || jsonb_build_object(
      'rejectionReason', 'La URL oficial devolvió 404',
      'rejectedAt', NOW()
    )
WHERE provider = 'uefa-official'
  AND review_status = 'pending'
  AND source_url IN (
    'https://img.uefa.com/imgml/TP/players/1/history/28769.jpg',
    'https://img.uefa.com/imgml/TP/players/2019/history/250195973.jpg',
    'https://img.uefa.com/imgml/TP/players/3/history/97787.jpg',
    'https://img.uefa.com/imgml/TP/players/2019/history/250064648.jpg',
    'https://img.uefa.com/imgml/TP/players/1/history/250056982.jpg',
    'https://img.uefa.com/imgml/TP/players/1/history/27918.jpg',
    'https://img.uefa.com/imgml/TP/players/2019/history/250186186.jpg',
    'https://img.uefa.com/imgml/TP/players/2019/history/250109323.jpg',
    'https://img.uefa.com/imgml/TP/players/3/history/36.jpg',
    'https://img.uefa.com/imgml/TP/players/2019/history/250091029.jpg'
  );
