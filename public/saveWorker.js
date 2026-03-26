/**
 * This script runs in the background.
 * It listens for a message containing the token data.
 */
self.onmessage = function (event) {
  console.log("Worker: Menerima data untuk diproses.");

  // The array of tokens is in event.data
  const tokens = event.data;

  // This is the potentially slow part: joining all lines from .conll file
  // into one string. By doing it here, we don't block the main browser thread
  const conllString = tokens
    .map((token) => `${token.text}\t${token.label}`)
    .join("\n");

  // Send the finished string back to the main app
  self.postMessage(conllString);
};
