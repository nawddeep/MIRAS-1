export const frontendFeatures = [
  { id: 'community', title: 'Community', hi: 'हमारी कहानियाँ', description: 'Memories, stories and suggestions from fellow travellers.', image: 'dawn', status: 'Accounts & live community' },
  { id: 'badges', title: 'Journey badges', hi: 'सफ़र की पहचान', description: 'Celebrate your trips and choose badges for your profile.', image: 'palace', status: 'Personal journey milestones' },
  { id: 'hotels', title: 'Find a stay', hi: 'आपका ठिकाना', description: 'Explore nearby hotels and compare your booking options.', image: 'golden', status: 'Compare prices' },
  { id: 'locals', title: 'Explore with a local', hi: 'स्थानीय साथी', description: 'Discover the city through a local companion’s eyes.', image: 'garden', status: 'Verified local hosts' },
  { id: 'rentals', title: 'Bikes & cars', hi: 'सफ़र की सवारी', description: 'Find rental shops, get directions and contact them.', image: 'palace', status: 'Call & directions' },
  { id: 'hidden', title: 'Hidden Udaipur', hi: 'अनदेखा उदयपुर', description: 'Small discoveries, quiet corners and community suggestions.', image: 'garden', status: 'Guides & imported suggestions' },
  { id: 'account', title: 'Your social profile', hi: 'आपकी पहचान', description: 'Manage your profile, followers, privacy and memories.', image: 'artisan', status: 'Accounts available' },
] as const;
export type FrontendFeatureId = typeof frontendFeatures[number]['id'];
