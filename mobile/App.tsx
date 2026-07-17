import { AuthProvider } from './src/context/AuthContext';
import { GoalsProvider } from './src/context/GoalsContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <GoalsProvider>
        <RootNavigator />
      </GoalsProvider>
    </AuthProvider>
  );
}
