import { UpcomingCatalystsGrid } from './UpcomingCatalystsGrid';
import { ResultsScrollDeck } from './ResultsScrollDeck';

export default function LandingExamples({ onEnterTerminal }: { onEnterTerminal: (tab?: string) => void }) {
  return <><UpcomingCatalystsGrid onEnterTerminal={onEnterTerminal} /><ResultsScrollDeck onEnterTerminal={onEnterTerminal} /></>;
}
