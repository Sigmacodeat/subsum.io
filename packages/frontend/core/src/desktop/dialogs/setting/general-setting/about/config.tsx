import {
  GithubIcon,
  DiscordIcon,
} from './icons';

export const relatedLinks = [
  {
    icon: <GithubIcon />,
    title: 'GitHub',
    link: BUILD_CONFIG.githubUrl,
  },
  {
    icon: <DiscordIcon />,
    title: 'Discord',
    link: BUILD_CONFIG.discordUrl,
  },
];
