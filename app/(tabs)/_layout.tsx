import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { SusuColors } from "@/constants/theme";
import { Ionicons, Octicons } from "@expo/vector-icons";

type TabIconProps = {
  children: (color: string) => React.ReactNode;
  focused: boolean;
};

function TabIcon({ children, focused }: TabIconProps) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      {children(focused ? SusuColors.accentGold : "#7A8984")}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: SusuColors.primary,
        tabBarInactiveTintColor: "#7A8984",
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              {(color) => (
                <Octicons size={21} name={focused ? "home-fill" : "home"} color={color} />
              )}
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              {(color) => (
                <Ionicons size={21} name={focused ? "people" : "people-outline"} color={color} />
              )}
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="fundraising"
        options={{
          title: 'Fundraising',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              {(color) => (
                <Ionicons size={21} name={focused ? "heart" : "heart-outline"} color={color} />
              )}
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              {(color) => (
                <Ionicons size={21} name={focused ? "wallet" : "wallet-outline"} color={color} />
              )}
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              {(color) => (
                <Ionicons size={22} name={focused ? "person" : "person-outline"} color={color} />
              )}
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 46,
  },
  iconContainerActive: {
    backgroundColor: SusuColors.primary,
    borderRadius: 17,
    shadowColor: SusuColors.primaryDark,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  tabBar: {
    backgroundColor: SusuColors.surface,
    borderTopColor: "#E4EAE7",
    paddingTop: 6,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
});
