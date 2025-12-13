export interface Avatar {
  name: string;
  image: string;
}

export const avatarList: Record<string, Avatar> = {
  blackMale: {
    name: 'Black Male Chef',
    image: '/avatars/black-male-chef.gif'
  },
  whiteMale: {
    name: 'White Male Chef',
    image: '/avatars/white-male-chef.gif'
  },
  blackFemale: {
    name: 'Black Female Chef',
    image: '/avatars/black-female-chef.gif'
  },
  whiteFemale: {
    name: 'White Female Chef',
    image: '/avatars/white-female-chef.gif'
  }
};

export const moods = ['professional', 'casual', 'friendly'];