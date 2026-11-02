ALTER TABLE `comments`
  ADD COLUMN `is_pinned` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD INDEX `cmt_pinned_idx` (`target_type`, `target_id`, `is_pinned`);
