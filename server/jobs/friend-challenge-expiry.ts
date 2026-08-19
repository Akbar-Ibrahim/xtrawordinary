import { getStorage } from "../storage";
import { log } from "../logger";

export async function runFriendChallengeExpiry() {
  try {
    const expired = await getStorage().expireFriendChallenges();
    if (expired > 0) log(`Expired ${expired} pending challenge(s)`, "friend-challenges");
  } catch (err) {
    log(`Expiry error: ${err}`, "friend-challenges", "error");
  }
}
