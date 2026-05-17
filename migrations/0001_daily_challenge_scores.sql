CREATE TABLE IF NOT EXISTS `daily_challenge_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `challenge_date` varchar(20) NOT NULL,
  `game_slug` varchar(100) NOT NULL,
  `score` int NOT NULL DEFAULT 0,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dcs_user_date_idx` (`user_id`, `challenge_date`),
  KEY `dcs_date_slug_idx` (`challenge_date`, `game_slug`),
  KEY `dcs_user_idx` (`user_id`)
);
