export const isDev = process.env.NODE_ENV !== "production";

export const MAX_MOBILE_WIDTH = 768;

export const MAIN_API_BASE_URL = process.env.MAIN_API_BASE_URL
  ? process.env.MAIN_API_BASE_URL
  : isDev
  ? "https://185b-27-7-18-129.ngrok-free.app"
  : "https://z1gz9i-ip-192-140-152-19.tunnelmole.net";

export const CHAT_API_BASE_URL = process.env.CHAT_API_BASE_URL
  ? process.env.CHAT_API_BASE_URL
  : isDev
  ? "http://localhost:8084"
  : "https://pp4vaiiifm.us-east-1.awsapprunner.com";

export const APP_NAME = "instavid";
