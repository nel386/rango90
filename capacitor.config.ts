import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rango90.app",
  appName: "Rango 90",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 450,
      backgroundColor: "#161616",
      showSpinner: false,
    },
  },
};

export default config;
