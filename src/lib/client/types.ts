export type DeviceStatus = "online" | "idle" | "offline";

export type ApiDevice = {
  id: number;
  deviceKey: string;
  name: string;
  kind: string;
  platform: string;
  browser: string;
  address: string | null;
  localIp: string | null;
  macAddress: string | null;
  userAgent: string | null;
  screenSharing: number;
  status: DeviceStatus;
  lastSeenAt: string;
  createdAt: string;
};

export type SharedFile = {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  targetDevice: string | null;
  createdAt: string;
  /** false se il contenuto non è presente su questo server */
  available: boolean;
};

export type ServerInfo = {
  currentOrigin: string;
  httpPort: number;
  httpsPort: number;
  httpsUrl: string;
  primaryIp: string | null;
  localIps: { interface: string; address: string; isLinkLocal: boolean }[];
  isCloudSandbox: boolean;
};

export type DeviceIdentity = {
  kind: string;
  platform: string;
  browser: string;
};

export type RemoteInputPayload = {
  type: string;
  x?: number;
  y?: number;
  button?: number;
  buttons?: number;
  key?: string;
  code?: string;
  keyCode?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  deltaX?: number;
  deltaY?: number;
  deltaZ?: number;
};

export type RemoteCommandType = "alert" | "beep" | "openUrl" | "clipboard";

export type RemoteCommand = {
  id: string;
  fromName: string;
  type: RemoteCommandType;
  value?: string;
  timestamp: number;
};

export type IncomingSignal = {
  id: number;
  fromDeviceKey: string;
  type: string;
  payload: string;
};

export type Section = "overview" | "transfers" | "devices" | "network-help";
