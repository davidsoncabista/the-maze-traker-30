
import { View, Button, ActivityIndicator, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase'; // Ensure this path is correct

// Initialize Google Auth Request
// Make sure to configure your OAuth IDs in app.json
// For this example, we'll use placeholder IDs. Replace them with your actual IDs.
const useGoogleSignIn = () => {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID, // Ensure you have this in your .env
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID, // Ensure you have this in your .env
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID, // Ensure you have this in your .env
  });

  return { request, response, promptAsync };
};


export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { request, response, promptAsync } = useGoogleSignIn();

  // This effect handles the response from Google Sign-In
  useEffect(() => {
    if (loading) return; // Prevent multiple sign-in attempts

    if (response?.type === 'success') {
      setLoading(true);
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .catch(error => {
          console.error("Firebase sign-in error", error);
          setLoading(false); // Stop loading on error
        });
    } else if (response?.type === 'error' || response?.type === 'cancel') {
        setLoading(false); // Stop loading if user cancels or an error occurs
    }
  }, [response]);

  // This effect listens for the user's auth state and redirects if they are logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, redirect them away from the login page
        router.replace('/amazegame');
      }
      // If no user, we stay on the login screen, so no 'else' is needed here.
      // We only stop the loading indicator if the initial check is done.
      setLoading(false); 
    });

    return () => unsubscribe();
  }, []);


  const handleGoogleSignIn = () => {
    if (request) {
      setLoading(true);
      promptAsync();
    } else {
      console.error("Google Auth Request is not ready.");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button
          title="Entrar com o Google"
          disabled={!request}
          onPress={handleGoogleSignIn}
        />
      )}
    </View>
  );
}
