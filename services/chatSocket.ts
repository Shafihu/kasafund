import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, type Socket } from "socket.io-client";

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://172.20.10.3:5050/api";
const socketUrl = apiUrl.replace(/\/api\/?$/, "");

export async function createChatSocket(): Promise<Socket> {
  const token = await AsyncStorage.getItem("@KasaFund:authToken");
  return io(socketUrl, {
    auth: { token },
    reconnection: true,
    transports: ["websocket", "polling"],
  });
}
