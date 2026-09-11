import { useSearchParams } from 'react-router-dom';
import { BottomNav } from '../components/nav/BottomNav';
import { PlayerPanel } from './PlayerPanel';
export function ProfilePage() {
  const [params] = useSearchParams();
  const view = params.get('view') === 'stats' ? 'stats' : 'profile';
  return <div className="interval-page"><div className="interval-app has-bottom-nav">
    <h1 className="profile-page-title">{view === 'stats' ? 'Stats' : 'Profile'}</h1>
    <PlayerPanel view={view} />
    <BottomNav active={view} />
  </div></div>;
}
