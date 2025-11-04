/**
 * Simple logger utility for the hedge fund manager
 */

export class Logger {
  static info(message) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }

  static warn(message) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  }

  static error(message, ...args) {
    const timestamp = new Date().toISOString();
    if (args.length > 0) {
      console.error(`[ERROR] ${timestamp} - ${message}`, ...args);
    } else {
      console.error(`[ERROR] ${timestamp} - ${message}`);
    }
  }

  static debug(message) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
  }
}

