import { Workspace } from './types';

export const workspaces: Workspace[] = [
  {
    id: 'personal',
    name: 'Personal',
    color: '#EA9B24',
    categories: ['Products', 'Research', 'Systems', 'Tools'],
    projects: [
      {
        id: '1',
        name: 'Atlas',
        description: '"A map of how to think, not what to know." A research-driven design tool mapping interaction-design behavior.',
        category: 'Research',
        status: 'Active',
        url: 'https://atlas-slice.vercel.app/',
        todos: [],
      },
      {
        id: '2',
        name: 'Design or Disaster',
        description: 'An interactive design-judgment game evaluating interface decisions against an expert panel.',
        category: 'Research',
        status: 'Review',
        url: 'https://design-or-disaster.vercel.app/',
        todos: [],
      },
      {
        id: '3',
        name: 'Invisible Interfaces',
        description: 'An interactive essay arguing that good interaction design makes interfaces disappear.',
        category: 'Research',
        status: 'Shipped',
        url: 'https://invisible-interfaces.vercel.app/',
        todos: [],
      },
      {
        id: '4',
        name: 'Pentimento',
        description: '"A memoir of your archive." A critique of algorithmic autobiography allowing visible user corrections.',
        category: 'Research',
        status: 'Active',
        url: 'https://pentimento-lovat.vercel.app/',
        todos: [],
      },
      {
        id: '5',
        name: 'Daynero',
        description: 'A minimalist time-tracking and invoicing utility for freelance designers.',
        category: 'Products',
        status: 'Active',
        url: 'https://example.com/daynero',
        todos: [],
      },
      {
        id: '6',
        name: 'Interface Behaviors',
        description: 'A living pattern library cataloging interactive micro-behaviors and edge cases.',
        category: 'Systems',
        status: 'On Hold',
        url: 'https://example.com/behaviors',
        todos: [],
      },
      {
        id: '7',
        name: 'Interaction Atlas',
        description: 'Internal CLI tool to scaffold interaction-heavy React components.',
        category: 'Tools',
        status: 'Review',
        url: 'https://example.com/cli',
        todos: [],
      }
    ]
  },
  {
    id: 'fluxion',
    name: 'Fluxion',
    color: '#F5141F',
    categories: ['Client Websites', 'Brand Identity', 'Internal Tools', 'Experiments'],
    projects: [
      {
        id: 'f1',
        name: 'Vanguard Rebrand',
        description: 'Complete visual identity overhaul and design system for a leading fintech startup.',
        category: 'Brand Identity',
        status: 'Active',
        url: 'https://example.com/vanguard',
        todos: [
          { id: 'f1a', text: 'Finalize logo concepts', completed: true },
          { id: 'f1b', text: 'Prepare brand guidelines PDF', completed: false }
        ],
      },
      {
        id: 'f2',
        name: 'Lumina Dashboard',
        description: 'Admin portal and analytics dashboard for the Lumina hardware ecosystem.',
        category: 'Internal Tools',
        status: 'Review',
        url: 'https://example.com/lumina',
        todos: [],
      },
      {
        id: 'f3',
        name: 'Studio Landing',
        description: 'WebGL heavy marketing site exploring physical lighting in digital spaces.',
        category: 'Experiments',
        status: 'Active',
        url: 'https://example.com/studio',
        todos: [],
      }
    ]
  }
];
