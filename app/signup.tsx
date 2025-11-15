import React, { useEffect, useState } from 'react';
import { View, Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebase/firebase';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

export default function Signup() {
  const [email, setEmail] = useState<string>('');
  const [pass, setPass] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return unsub;
  }, []);

  async function onSignup() {
    if (!name.trim() || !email.trim() || !pass.trim()) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (pass.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name,
        location: location.trim() || '',
        artisanCategory: '',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success!', 'Account created successfully. Welcome to Kala.ai!');
      router.replace('/');
    } catch (err: any) {
      let errorMessage = 'Signup failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Text style={styles.logo}>🎨</Text>
          <Text style={styles.title}>Join Kala.ai</Text>
          <Text style={styles.subtitle}>Create your artisan account and start selling</Text>
        </View>

        <Card style={styles.formCard}>
          <TextInput 
            label="Full Name" 
            value={name} 
            onChangeText={setName} 
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />
          
          <TextInput 
            label="Location (Optional)" 
            value={location} 
            onChangeText={setLocation} 
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="map-marker" />}
            placeholder="e.g., Mumbai, India"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />
          
          <TextInput 
            label="Email" 
            value={email} 
            onChangeText={setEmail} 
            mode="outlined"
            keyboardType="email-address" 
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            left={<TextInput.Icon icon="email" />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />
          
          <TextInput 
            label="Password" 
            secureTextEntry 
            value={pass} 
            onChangeText={setPass} 
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            right={<TextInput.Icon icon={pass.length >= 6 ? "check-circle" : "alert-circle"} />}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />
          
          {pass.length > 0 && pass.length < 6 && (
            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>
          )}

          <Button 
            mode="contained" 
            onPress={onSignup} 
            style={styles.signupButton}
            loading={loading}
            disabled={loading || !name.trim() || !email.trim() || pass.length < 6}
            buttonColor={colors.primary}
            icon="account-plus"
          >
            Create Account
          </Button>
        </Card>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Button 
            mode="text" 
            onPress={() => router.push('/login')}
            textColor={colors.primary}
            style={styles.loginLink}
          >
            Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  passwordHint: {
    ...typography.caption,
    color: colors.warning,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  signupButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  loginLink: {
    marginLeft: -spacing.sm,
  },
});