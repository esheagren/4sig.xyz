import { createRoot } from 'react-dom/client';
import { ScorecardStudies } from './components/interval/ScorecardStudies';
import gameStyles from './components/interval/style.css?inline';

const style = document.createElement('style'); style.textContent = gameStyles; document.head.append(style);
createRoot(document.getElementById('scorecard-studies')!).render(<ScorecardStudies />);
