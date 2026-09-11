import React from 'react';
import AccountingManagement from './AccountingManagement';

// Separate route identity for /accounting/journal (sidebar: "Journal Entry") —
// reuses AccountingManagement's existing accounts/journal tabs internally
// (composition, not duplicated logic) but always opens on the journal tab
// with its own page title, distinct from the general /accounting landing page.
const JournalEntryPage: React.FC = () => {
  return <AccountingManagement initialTab="journal" title="Journal Entry" />;
};

export default JournalEntryPage;
