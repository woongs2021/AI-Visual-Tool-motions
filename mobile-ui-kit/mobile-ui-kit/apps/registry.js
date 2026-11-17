/* =========================================================================================================================
   App registry — the one list of screens. index.html builds its screen list, capture guide and 390 × 844 check from it;
   scripts/capture.mjs captures every entry and its states.

   scripts/new-app.mjs adds entries above the "@new-apps" line. Fields:
     id      file name and data-au-screen value (kebab-case)
     num     order shown in the preview ("04", or "1.3" = scenario 1, screen 3)
     group   scenario name — the preview lists screens under it, with a Play button
     app     the accent (data-au-app) when it differs from id · store: the scenario's shared demo-data key
     start   true on the scenario's first screen (where Play starts)
     name    app name (title in the app bar)
     desc    one line for the preview list
     file    the screen's HTML file
     accent  the app colour (hex)
     css     optional: the app's stylesheet (accent + its own styles), loaded by the preview for its colour chip
     states  capture states: { label, q } — q is the URL query that puts the screen in that state ('' = default)
     notes   capture notes shown in the preview
   ========================================================================================================================= */
window.AU_APPS = [
  {
    id: 'pc-health-home', num: '1.1', group: 'PC Health', app: 'pc-health', store: 'pc-health', start: true,
    name: 'Home', desc: 'Recent checks and a new check', file: 'pc-health-home.html',
    states: [
      { label: 'Recent checks', q: '' },
    ],
    notes: [
      'Tap a recent check to open its result, or New Check to start the flow.',
    ],
  },
  {
    id: 'pc-health-connect', num: '1.2', group: 'PC Health', app: 'pc-health', store: 'pc-health',
    name: 'Connect PC', desc: 'Find the PC with a pairing code', file: 'pc-health-connect.html',
    states: [
      { label: 'Connected', q: '' },
      { label: 'Searching', q: 'state=waiting' },
    ],
    notes: [
      'Live: the PC is found after ~2 s and Start Scan turns on. capture=1 shows it connected.',
    ],
  },
  {
    id: 'pc-health-scan', num: '1.3', group: 'PC Health', app: 'pc-health', store: 'pc-health',
    name: 'Scanning', desc: 'Progress ring over 5 checks', file: 'pc-health-scan.html',
    states: [
      { label: '64%', q: '' },
      { label: '20%', q: 'p=20' },
      { label: '95%', q: 'p=95' },
    ],
    notes: [
      'Live: runs for ~7 s, then opens the result. capture=1 holds it at 64% (or ?p=).',
    ],
  },
  {
    id: 'pc-health', num: '1.4', group: 'PC Health', app: 'pc-health', store: 'pc-health',
    name: 'Result', desc: 'Score 98% for CPU, GPU and memory', file: 'pc-health.html',
    states: [
      { label: '98% Healthy', q: '' },
      { label: '84% Fair', q: 'scenario=fair' },
      { label: '61% Needs attention', q: 'scenario=attention' },
      { label: 'GPU expanded', q: 'open=gpu' },
      { label: 'Report sheet', q: 'sheet=report' },
    ],
    notes: [
      'The main screen. Expanded cards link to the part detail; View Full Report opens the report screen.',
      'Rescan cycles Healthy → Fair → Needs attention.',
    ],
  },
  {
    id: 'pc-health-part', num: '1.5', group: 'PC Health', app: 'pc-health', store: 'pc-health',
    name: 'Part Detail', desc: 'Temperature chart, then ask the seller', file: 'pc-health-part.html',
    states: [
      { label: 'GPU', q: '' },
      { label: 'GPU running hot', q: 'part=gpu&scenario=fair' },
      { label: 'Memory errors', q: 'part=memory&scenario=attention' },
      { label: 'Ask the seller', q: 'part=gpu&scenario=fair&sheet=ask' },
    ],
    notes: [
      '?part=cpu|gpu|memory, ?scenario=healthy|fair|attention. The chart is demo data.',
    ],
  },
  {
    id: 'pc-health-report', num: '1.6', group: 'PC Health', app: 'pc-health', store: 'pc-health',
    name: 'Full Report', desc: 'Summary, components and a share link', file: 'pc-health-report.html',
    states: [
      { label: 'Report', q: '' },
      { label: 'Share sheet', q: 'sheet=share' },
    ],
    notes: [
      'Copy link and Share use demo toasts; the link domain is an example.',
    ],
  },
  {
    id: 'meeting-notes-home', num: '2.1', group: 'Meeting Notes', app: 'meeting-notes', store: 'meeting-notes', start: true,
    name: 'Home', desc: 'Recent meetings and a new recording', file: 'meeting-notes-home.html',
    states: [
      { label: 'Meetings', q: '' },
    ],
    notes: [
      'After a recording, the new meeting appears at the top (stored in the browser).',
    ],
  },
  {
    id: 'meeting-notes', num: '2.2', group: 'Meeting Notes', app: 'meeting-notes', store: 'meeting-notes',
    name: 'Recording', desc: 'Timer, waveform and live transcript', file: 'meeting-notes.html',
    states: [
      { label: 'Recording 02:36', q: '' },
      { label: 'Paused', q: 'rec=paused' },
      { label: 'Saved', q: 'rec=stopped' },
      { label: 'Action items', q: 'tab=actions' },
      { label: 'Just started', q: 'fresh=1' },
    ],
    notes: [
      'The main screen. Stop saves and opens Processing.',
      'capture=1 holds the timer at 02:36.',
    ],
  },
  {
    id: 'meeting-notes-processing', num: '2.3', group: 'Meeting Notes', app: 'meeting-notes', store: 'meeting-notes',
    name: 'Processing', desc: 'Transcribe, summarize, find actions', file: 'meeting-notes-processing.html',
    states: [
      { label: '55%', q: '' },
      { label: '15%', q: 'p=15' },
      { label: '90%', q: 'p=90' },
    ],
    notes: [
      'Live: ~5 s, then opens the notes. capture=1 holds it at 55% (or ?p=).',
    ],
  },
  {
    id: 'meeting-notes-notes', num: '2.4', group: 'Meeting Notes', app: 'meeting-notes', store: 'meeting-notes',
    name: 'Notes', desc: 'AI summary with points, decisions and actions', file: 'meeting-notes-notes.html',
    states: [
      { label: 'Key points', q: '' },
      { label: 'Decisions', q: 'tab=decisions' },
      { label: 'Actions', q: 'tab=actions' },
      { label: 'Design Review', q: 'm=design' },
      { label: 'Share sheet', q: 'sheet=share' },
    ],
    notes: [
      '?m=q4|design|oneonone|acme picks the meeting. Summaries are demo data (DEMO tag).',
    ],
  },
  {
    id: 'meeting-notes-transcript', num: '2.5', group: 'Meeting Notes', app: 'meeting-notes', store: 'meeting-notes',
    name: 'Transcript', desc: 'Search, speakers and playback', file: 'meeting-notes-transcript.html',
    states: [
      { label: 'Playing at 0:48', q: '' },
      { label: 'Search “legal”', q: 'q=legal' },
      { label: 'Only Sarah', q: 'who=Sarah' },
    ],
    notes: [
      'A scrolling list. Play follows along without audio; tap a line to jump.',
    ],
  },
  {
    id: 'our-discussion-home', num: '3.1', group: 'Our Discussion', app: 'our-discussion', store: 'our-discussion', start: true,
    name: 'Home', desc: 'Topics in progress and decided', file: 'our-discussion-home.html',
    states: [
      { label: 'Topics', q: '' },
      { label: 'New topic sheet', q: 'sheet=new' },
    ],
    notes: [
      'Travel Plans is the interactive topic; the others show a demo toast.',
    ],
  },
  {
    id: 'our-discussion', num: '3.2', group: 'Our Discussion', app: 'our-discussion', store: 'our-discussion',
    name: 'Topic', desc: 'Options and 60% agreed', file: 'our-discussion.html',
    states: [
      { label: '60% (different picks)', q: '' },
      { label: '80% (same pick)', q: 'choice=a' },
      { label: 'Panel sheet', q: 'sheet=discuss' },
      { label: 'About the number', q: 'info=1' },
    ],
    notes: [
      'The main screen. Compare, Points and Discuss open the detail screens.',
    ],
  },
  {
    id: 'our-discussion-compare', num: '3.3', group: 'Our Discussion', app: 'our-discussion', store: 'our-discussion',
    name: 'Compare', desc: 'Italy vs Japan, then pick', file: 'our-discussion-compare.html',
    states: [
      { label: 'Mina picks Japan', q: '' },
      { label: 'Both pick Italy', q: 'choice=a' },
    ],
    notes: [
      'The footer buttons change your pick; it is shared with every screen of this scenario.',
    ],
  },
  {
    id: 'our-discussion-thread', num: '3.4', group: 'Our Discussion', app: 'our-discussion', store: 'our-discussion',
    name: 'Discussion', desc: 'Chat with quick replies', file: 'our-discussion-thread.html',
    states: [
      { label: 'Conversation', q: '' },
    ],
    notes: [
      'Joon’s replies are simulated (labelled DEMO). A scrolling list.',
    ],
  },
  {
    id: 'our-discussion-agreement', num: '3.5', group: 'Our Discussion', app: 'our-discussion', store: 'our-discussion',
    name: 'Agreement', desc: '5 points for both sides', file: 'our-discussion-agreement.html',
    states: [
      { label: '3 of 5', q: '' },
      { label: '5 of 5', q: 'choice=a&agreed=activities' },
    ],
    notes: [
      'Agree on every point (and the same destination) to enable Make It Official.',
    ],
  },
  {
    id: 'our-discussion-decision', num: '3.6', group: 'Our Discussion', app: 'our-discussion', store: 'our-discussion',
    name: 'Decision', desc: 'Italy and next steps', file: 'our-discussion-decision.html',
    states: [
      { label: 'Decided', q: '' },
      { label: 'Not decided yet', q: 'pending=1' },
    ],
    notes: [
      'Live, it shows the real state; capture=1 shows the decided state.',
    ],
  },
  // @new-apps — scripts/new-app.mjs inserts new entries above this line
];
