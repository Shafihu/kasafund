import NetInfo from "@react-native-community/netinfo";
import { useAuthStore } from "../stores/useAuthStore";


class NetworkService {
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen for network state changes
    NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      this.updateOnlineStatus(isConnected || false);
    });

    // Check initial network status
    NetInfo.fetch().then((state) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      this.updateOnlineStatus(isConnected || false);
    });
  }

  private updateOnlineStatus(isOnline: boolean) {
    // Update only auth and scan stores with the new online status
    useAuthStore.getState().setOnlineStatus(isOnline);

    console.log(`Network status changed: ${isOnline ? "Online" : "Offline"}`);
  }

  async checkConnectivity(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return (state.isConnected && state.isInternetReachable) || false;
  }

  // Test API connectivity
  async testApiConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://httpbin.org/get", {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error("API connectivity test failed:", error);
      return false;
    }
  }
}

export const networkService = new NetworkService();