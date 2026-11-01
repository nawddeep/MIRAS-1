// Mock users and stories (MIRAS Udaipur). Mock stories are always "fresh": their createdAt is
// computed from hoursAgo every time the API is read, so they never expire in the demo.

export const USERS = [
  { id: 'you', name: 'You', handle: 'you', color: '#b4532a' },
  { id: 'priya', name: 'Priya Sharma', handle: 'priya_wanders', color: '#7c3aed' },
  { id: 'nandini', name: 'Nandini Mehta', handle: 'nandini_udaipur', color: '#e11d48', local: true },
  { id: 'rohan', name: 'Rohan Iyer', handle: 'rohan_trails', color: '#0f766e' },
  { id: 'meera', name: 'Meera Nair', handle: 'meera_solo', color: '#be185d' },
  { id: 'kabir', name: 'Kabir Singh', handle: 'kabir_foodie', color: '#b45309' },
  { id: 'zoya', name: 'Zoya Ali', handle: 'zoya_lakeside', color: '#0e7490', local: true },
  { id: 'arjun', name: 'Arjun Rathore', handle: 'arjun_mewar', color: '#7c2d12', local: true },
];

export const PLACES = ['City Palace', 'Lake Pichola', 'Karni Mata Temple', 'Moti Magri', 'Gangaur Ghat', 'Fateh Sagar', 'Sajjangarh', 'Jagdish Temple', 'Bagore ki Haveli', 'Old City'];

/**
 * projection: 'equirect' = full 360x180 sphere, 'pano' = wide panorama wrapped on a cylinder
 * (panoDeg degrees around), 'flat' = normal photo / video.
 */
export const MOCK_STORIES = [
  { id: 'm-priya-1', userId: 'priya', hoursAgo: 1.2, mediaType: 'video', projection: 'equirect', src: '/mock/city_palace_360.mp4', poster: '/mock/city_palace_360.jpg', duration: 15, loop: true, caption: 'Standing in the middle of City Palace courtyard 😍 look around!', place: 'City Palace' },
  { id: 'm-priya-2', userId: 'priya', hoursAgo: 0.6, mediaType: 'image', projection: 'equirect', src: '/mock/pichola_360.jpg', duration: 10, caption: 'Golden hour on Lake Pichola – turn around for Jag Mandir', place: 'Lake Pichola' },
  { id: 'm-nandini-1', userId: 'nandini', hoursAgo: 3.5, mediaType: 'video', projection: 'equirect', src: '/mock/pichola_360.mp4', poster: '/mock/pichola_360.jpg', duration: 53, caption: 'Full boat ride in 360 – 53 seconds of pure Pichola 🚤', place: 'Lake Pichola' },
  { id: 'm-nandini-2', userId: 'nandini', hoursAgo: 2.1, mediaType: 'image', projection: 'flat', src: '/mock/city_palace.jpg', duration: 6, caption: 'Morning walk to the palace gate', place: 'City Palace' },
  { id: 'm-rohan-1', userId: 'rohan', hoursAgo: 5, mediaType: 'video', projection: 'equirect', src: '/mock/karni_mata_360.mp4', poster: '/mock/karni_mata_360.jpg', duration: 12, loop: true, caption: 'Made it to Karni Mata before sunrise 🌄', place: 'Karni Mata Temple' },
  { id: 'm-meera-1', userId: 'meera', hoursAgo: 7, mediaType: 'image', projection: 'pano', panoDeg: 200, src: '/mock/udaipur_pano.jpg', duration: 12, caption: 'Wide panorama of the old city from the rooftop café', place: 'Old City' },
  { id: 'm-meera-2', userId: 'meera', hoursAgo: 6.2, mediaType: 'image', projection: 'equirect', src: '/mock/moti_magri_360.jpg', duration: 10, caption: 'Maharana Pratap memorial – 360°', place: 'Moti Magri' },
  { id: 'm-kabir-1', userId: 'kabir', hoursAgo: 9, mediaType: 'video', projection: 'flat', src: '/mock/miras_intro.mp4', poster: '/mock/miras_intro.jpg', duration: 15, caption: 'This intro though 🔥 #MIRAS', place: 'Udaipur' },
  { id: 'm-zoya-1', userId: 'zoya', hoursAgo: 11, mediaType: 'image', projection: 'equirect', src: '/mock/test_pano_360.jpg', duration: 8, caption: 'Testing my new 360 camera – thoughts?', place: 'Fateh Sagar' },
  { id: 'm-arjun-1', userId: 'arjun', hoursAgo: 14, mediaType: 'image', projection: 'flat', src: '/mock/karni_mata.jpg', duration: 6, caption: 'Ropeway views from Machla Magra', place: 'Karni Mata Temple' },
  { id: 'm-arjun-2', userId: 'arjun', hoursAgo: 13, mediaType: 'image', projection: 'flat', src: '/mock/moti_magri.jpg', duration: 6, caption: 'History walk – Moti Magri', place: 'Moti Magri' },
];

export const MOCK_VIEWS = {
  'm-priya-1': ['nandini', 'rohan', 'meera'],
  'm-nandini-1': ['priya', 'kabir'],
};
export const MOCK_REACTIONS = {
  'm-priya-1': [{ by: 'nandini', emoji: '😍', at: 0.8 }, { by: 'rohan', text: 'Wow, how did you shoot this?', at: 0.5 }],
};
