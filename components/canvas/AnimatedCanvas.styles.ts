import { StyleSheet } from "react-native";

export const animatedCanvasStyles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  initialsAvatar: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#0B4D3E",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  initialsText: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  headerSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
});
