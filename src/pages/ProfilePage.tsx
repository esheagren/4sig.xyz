import { BottomNav } from '../components/nav/BottomNav';
import { PlayerPanel } from './PlayerPanel';
export function ProfilePage() {
  return <div className="interval-page"><div className="interval-app has-bottom-nav">
    <h1 className="sr-only">Your account</h1>
    <PlayerPanel initialView="profile" />
    <BottomNav active="profile" />
  </div></div>;
}
