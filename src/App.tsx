/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import CommandPalette from './components/CommandPalette';
import { InboxPanel } from './components/Inbox';

export default function App() {
  useEffect(() => {
    const evtSource = new EventSource('/api/events');
    
    evtSource.addEventListener('context-changed', (event) => {
      window.dispatchEvent(new CustomEvent('workspace-context-changed'));
    });
    
    evtSource.addEventListener('data-changed', (event) => {
      window.dispatchEvent(new CustomEvent('workspace-data-changed'));
    });
    
    return () => evtSource.close();
  }, []);

  return (
    <>
      <Dashboard />
      <InboxPanel />
      <CommandPalette />
    </>
  );
}

