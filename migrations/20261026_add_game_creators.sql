-- Existing catalog games remain unowned (NULL) and can only be managed by admins.
ALTER TABLE `games`
  ADD COLUMN `creator_id` INT NULL AFTER `slug`,
  ADD INDEX `games_creator_idx` (`creator_id`),
  ADD CONSTRAINT `games_creator_fk`
    FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
