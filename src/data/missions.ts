export interface MissionData {
  id: string;
  name: string;
  subtitle: string;
  date: string;
  description: string;
  crew: string[];
  images: { src: string; caption: string }[];
  terrain: {
    roughness: number;
    craterDensity: number;
    landingZoneWidth: number;
    landingZoneX: number;
    startAltitude: number;
  };
  roverAvailable: boolean;
}

export const missions: MissionData[] = [
  {
    id: 'apollo-11',
    name: 'Apollo 11',
    subtitle: 'First Crewed Moon Landing',
    date: 'July 20, 1969',
    description:
      'Apollo 11 was the first manned mission to land on the Moon. A historic leap for mankind.',
    crew: ['Neil Armstrong', 'Buzz Aldrin', 'Michael Collins'],
    images: [
      { src: '/images/placeholder.svg', caption: 'Moon Landing' },
      { src: '/images/placeholder.svg', caption: 'One Small Step' },
      { src: '/images/placeholder.svg', caption: 'Earthrise' },
      { src: '/images/placeholder.svg', caption: 'Eagle Lander' },
    ],
    terrain: {
      roughness: 0.3,
      craterDensity: 0.2,
      landingZoneWidth: 40,
      landingZoneX: 400,
      startAltitude: 150,
    },
    roverAvailable: false,
  },
  {
    id: 'apollo-12',
    name: 'Apollo 12',
    subtitle: 'Precision Landing',
    date: 'November 19, 1969',
    description:
      'Apollo 12 demonstrated precision landing capability, touching down near Surveyor 3.',
    crew: ['Pete Conrad', 'Alan Bean', 'Richard Gordon'],
    images: [
      { src: '/images/placeholder.svg', caption: 'Precision Landing' },
      { src: '/images/placeholder.svg', caption: 'Surveyor 3 Visit' },
      { src: '/images/placeholder.svg', caption: 'Surface EVA' },
      { src: '/images/placeholder.svg', caption: 'Intrepid Lander' },
    ],
    terrain: {
      roughness: 0.4,
      craterDensity: 0.3,
      landingZoneWidth: 35,
      landingZoneX: 580,
      startAltitude: 160,
    },
    roverAvailable: false,
  },
  {
    id: 'apollo-14',
    name: 'Apollo 14',
    subtitle: 'Fra Mauro Highlands',
    date: 'February 5, 1971',
    description:
      'Apollo 14 explored the Fra Mauro highlands, the intended target of the ill-fated Apollo 13.',
    crew: ['Alan Shepard', 'Edgar Mitchell', 'Stuart Roosa'],
    images: [
      { src: '/images/placeholder.svg', caption: 'Fra Mauro Landing' },
      { src: '/images/placeholder.svg', caption: 'Golf on the Moon' },
      { src: '/images/placeholder.svg', caption: 'Cone Crater' },
      { src: '/images/placeholder.svg', caption: 'Antares Lander' },
    ],
    terrain: {
      roughness: 0.5,
      craterDensity: 0.4,
      landingZoneWidth: 30,
      landingZoneX: 760,
      startAltitude: 170,
    },
    roverAvailable: false,
  },
  {
    id: 'apollo-15',
    name: 'Apollo 15',
    subtitle: 'First Lunar Rover',
    date: 'July 30, 1971',
    description:
      'Apollo 15 was the first mission to use the Lunar Roving Vehicle, exploring Hadley Rille.',
    crew: ['David Scott', 'James Irwin', 'Alfred Worden'],
    images: [
      { src: '/images/placeholder.svg', caption: 'Hadley Rille' },
      { src: '/images/placeholder.svg', caption: 'First Rover Drive' },
      { src: '/images/placeholder.svg', caption: 'Mount Hadley' },
      { src: '/images/placeholder.svg', caption: 'Falcon Lander' },
    ],
    terrain: {
      roughness: 0.6,
      craterDensity: 0.4,
      landingZoneWidth: 25,
      landingZoneX: 940,
      startAltitude: 180,
    },
    roverAvailable: true,
  },
  {
    id: 'apollo-16',
    name: 'Apollo 16',
    subtitle: 'Descartes Highlands',
    date: 'April 21, 1972',
    description:
      'Apollo 16 explored the lunar highlands near the Descartes crater.',
    crew: ['John Young', 'Charles Duke', 'Ken Mattingly'],
    images: [
      { src: '/images/placeholder.svg', caption: 'Descartes Landing' },
      { src: '/images/placeholder.svg', caption: 'Rover Traverse' },
      { src: '/images/placeholder.svg', caption: 'Stone Mountain' },
      { src: '/images/placeholder.svg', caption: 'Orion Lander' },
    ],
    terrain: {
      roughness: 0.7,
      craterDensity: 0.5,
      landingZoneWidth: 20,
      landingZoneX: 1120,
      startAltitude: 180,
    },
    roverAvailable: true,
  },
  {
    id: 'apollo-17',
    name: 'Apollo 17',
    subtitle: 'Final Moon Mission',
    date: 'December 11, 1972',
    description:
      'Apollo 17 was the last crewed mission to the Moon, exploring the Taurus-Littrow valley.',
    crew: ['Gene Cernan', 'Harrison Schmitt', 'Ron Evans'],
    images: [
      { src: '/images/placeholder.svg', caption: 'Taurus-Littrow' },
      { src: '/images/placeholder.svg', caption: 'Last Moonwalk' },
      { src: '/images/placeholder.svg', caption: 'Orange Soil' },
      { src: '/images/placeholder.svg', caption: 'Challenger Lander' },
    ],
    terrain: {
      roughness: 0.8,
      craterDensity: 0.6,
      landingZoneWidth: 15,
      landingZoneX: 1300,
      startAltitude: 190,
    },
    roverAvailable: true,
  },
];
