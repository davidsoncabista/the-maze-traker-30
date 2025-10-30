import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Custom hook to manage authentication state
const useAuth = () => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);
  return { user };
};

const AuthLayout = () => {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)'; // Assuming we create an auth group

    if (user && !inAuthGroup) {
      // User is signed in, move to the main app screen
      router.replace('/amazegame');
    } else if (!user) {
      // User is not signed in, move to the login screen
      router.replace('/login');
    }
  }, [user]);

  return <Slot />;
};

export default AuthLayout;
