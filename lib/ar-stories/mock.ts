// Sample users and stories for demo mode. They use only media the team owns or has a rights entry for in
// content/media.json. Sample stories never expire, take no replies, and are labelled as samples in the app.

export type StoryUser = { id: string; name: string; handle: string; color: string; local?: boolean };

export const MOCK_USERS: StoryUser[] = [
  { id: "priya", name: "Priya Sharma", handle: "priya_wanders", color: "#7c3aed" },
  { id: "meera", name: "Meera Nair", handle: "meera_solo", color: "#be185d" },
  { id: "kabir", name: "Kabir Singh", handle: "kabir_foodie", color: "#b45309" },
  { id: "zoya", name: "Zoya Ali", handle: "zoya_lakeside", color: "#0e7490", local: true },
];

export const PLACES = ["City Palace", "Lake Pichola", "Karni Mata Temple", "Moti Magri", "Gangaur Ghat", "Fateh Sagar", "Sajjangarh", "Jagdish Temple", "Bagore ki Haveli", "Old City"];

type MockStory = {
  id: string;
  userId: string;
  hoursAgo: number;
  mediaType: "image" | "video";
  projection: "equirect" | "pano" | "flat";
  panoDeg?: number;
  src: string;
  poster?: string;
  duration: number;
  caption: string;
  place: string;
};

export const MOCK_STORIES: MockStory[] = [
  { id: "m-priya-1", userId: "priya", hoursAgo: 1.2, mediaType: "image", projection: "equirect", src: "/media/immersive/heritage-view-44ce9931/panorama.jpg", duration: 10, caption: "A night panorama of a lakeside ghat, captured with the MIRAS 360° camera. Drag to look around.", place: "Udaipur" },
  { id: "m-zoya-1", userId: "zoya", hoursAgo: 2.4, mediaType: "image", projection: "equirect", src: "/MIRAS_VR_Test_Panorama.png", duration: 8, caption: "A test grid: each tile shows its direction, so you can check 360, VR and AR.", place: "MIRAS test" },
  { id: "m-meera-1", userId: "meera", hoursAgo: 3.1, mediaType: "image", projection: "pano", panoDeg: 200, src: "/media/ar-stories/udaipur_pano.jpg", duration: 12, caption: "An illustration of an old-city street, wrapped around you. Not a photo of a real place.", place: "Old City" },
  { id: "m-kabir-1", userId: "kabir", hoursAgo: 4.5, mediaType: "video", projection: "flat", src: "/media/ar-stories/miras_intro.mp4", poster: "/media/ar-stories/miras_intro.jpg", duration: 15, caption: "The MIRAS intro.", place: "Udaipur" },
];
