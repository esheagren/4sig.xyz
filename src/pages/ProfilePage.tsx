import { BottomNav } from '../components/nav/BottomNav';
import { PlayerPanel } from './PlayerPanel';
export function ProfilePage() {
  return <div className="interval-page"><div className="interval-app has-bottom-nav">
    <h1 className="profile-page-title">Profile</h1>
    <PlayerPanel />
    <BottomNav active="profile" />
  </div></div>;
}
