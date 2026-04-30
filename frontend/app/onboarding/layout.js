import AppAuthGate from '../../components/AppAuthGate';

export default function OnboardingLayout({ children }) {
  return <AppAuthGate>{children}</AppAuthGate>;
}
