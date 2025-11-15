import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, LayoutAnimation, Platform, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { API_BASE_URL } from '../../constants/api';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import { auth, db } from '../../firebase/firebase';

export default function Profile() {
  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState<boolean>(false);
  
  // Product publishing state
  const [showPublish, setShowPublish] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [croppedImageBase64, setCroppedImageBase64] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const router = useRouter();

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Smooth animation configuration
  const configureLayoutAnimation = () => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  };

  const togglePersonalInfo = () => {
    configureLayoutAnimation();
    setShowPersonalInfo(!showPersonalInfo);
  };

  const togglePublish = () => {
    configureLayoutAnimation();
    setShowPublish(!showPublish);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          setName(data.name || '');
          setLocation(data.location || '');
          setPhone(data.phone || '');
          setAddress(data.address || '');
        }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function saveProfile() {
    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) return Alert.alert('Not signed in');
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, { 
        name, 
        location,
        phone,
        address,
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', 'Profile saved successfully!');
      setShowPersonalInfo(false);
    } catch (err: any) {
      Alert.alert('Save failed', err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Logout failed', err.message || String(err));
    }
  }

  // Product publishing functions
  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, base64: true });
    if (!res.canceled) {
      const asset = res.assets[0];
      setImageUri(asset.uri!);

      let dataUrl: string | null = null;
      if (asset.base64) {
        dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      } else {
        const fileBase64 = await FileSystem.readAsStringAsync(asset.uri!, { encoding: 'base64' });
        dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${fileBase64}`;
      }
      setCroppedImageBase64(dataUrl);
    }
  }

  async function cropImage() {
    if (!croppedImageBase64) return Alert.alert('Please pick an image first');
    
    try {
      setIsEnhancing(true);
      const resp = await fetch(`${API_BASE_URL}/api/enhance-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64 }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        Alert.alert('Enhance Image Failed', `Server returned ${resp.status}: ${errorText}`);
        return;
      }

      const json = await resp.json();
      if (json.ok && json.enhancedImageUrl) {
        setImageUri(json.enhancedImageUrl);
        setCroppedImageBase64(json.enhancedImageUrl);
        Alert.alert('Success', 'Image enhanced successfully.');
      } else {
        Alert.alert('Enhance Image Failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Crop error:', err);
      Alert.alert('Enhance Image Failed', err.message || 'Unable to enhance image');
    } finally {
      setIsEnhancing(false);
    }
  }

  async function generateProductInfo() {
    if (!croppedImageBase64) return Alert.alert('Please pick and enhance the image first');
    
    try {
      setIsGenerating(true);
      const resp = await fetch(`${API_BASE_URL}/api/generate-product-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64, language: 'hi-IN' }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        Alert.alert('Generate Text Failed', `Server returned ${resp.status}: ${errorText}`);
        return;
      }

      const json = await resp.json();
      
      if (json.ok) {
        setTitle(json.title || '');
        setDesc(json.description || '');
        if (json.estimatedPrice && json.estimatedPrice !== '0') {
          setPrice(json.estimatedPrice);
        }
        Alert.alert('Success', 'Title, description, and price generated.');
      } else {
        Alert.alert('Generate Text Failed', json.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Generate text error:', err);
      Alert.alert('Generate Text Failed', err.message || 'Unable to generate product info');
    } finally {
      setIsGenerating(false);
    }
  }

  async function publish() {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please login to publish products');
        return;
      }

      if (!title || !desc || !imageUri) {
        Alert.alert('Validation Error', 'Please fill title, description and image');
        return;
      }

      setIsPublishing(true);

      // Upload image to MongoDB via API
      let imageUrl = imageUri;
      
      const isDataUrl = imageUri.startsWith('data:image/');
      const isLocalFile = imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://');
      const isRemoteUrl = imageUri.startsWith('http://') || imageUri.startsWith('https://');
      
      if (isDataUrl || isLocalFile) {
        try {
          let imageBase64 = '';
          
          if (isDataUrl) {
            imageBase64 = imageUri.includes(',') ? imageUri : `data:image/jpeg;base64,${imageUri}`;
          } else if (isLocalFile) {
            const fileBase64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
            imageBase64 = `data:image/jpeg;base64,${fileBase64}`;
          }
          
          const uploadResp = await fetch(`${API_BASE_URL}/api/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              imageBase64,
              userId: user.uid 
            }),
          });
          
          const uploadJson = await uploadResp.json();
          
          if (uploadJson.ok && uploadJson.imageUrl) {
            imageUrl = uploadJson.imageUrl;
          } else {
            throw new Error(uploadJson.error || 'Upload failed');
          }
        } catch (uploadErr: any) {
          console.error('Image upload error:', uploadErr);
          Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
          setIsPublishing(false);
          return;
        }
      } else if (!isRemoteUrl) {
        if (croppedImageBase64 && croppedImageBase64.startsWith('data:image/')) {
          try {
            const uploadResp = await fetch(`${API_BASE_URL}/api/upload-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                imageBase64: croppedImageBase64,
                userId: user.uid 
              }),
            });
            
            const uploadJson = await uploadResp.json();
            
            if (uploadJson.ok && uploadJson.imageUrl) {
              imageUrl = uploadJson.imageUrl;
            } else {
              throw new Error(uploadJson.error || 'Upload failed');
            }
          } catch (uploadErr: any) {
            console.error('Image upload error:', uploadErr);
            Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
            setIsPublishing(false);
            return;
          }
        }
      }

      const productData = {
        uid: user.uid,
        title: title.trim(),
        description: desc.trim(),
        price: price ? parseFloat(price) : 0,
        quantity: quantity ? parseInt(quantity, 10) : 1,
        imageUri: imageUrl,
        marketplaces: { amazon: true, flipkart: true, etsy: true },
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'products'), productData);
      
      try {
        const payload = {
          title,
          description: desc,
          price,
          quantity,
          marketplaces: { amazon: true, flipkart: true, etsy: true },
          imageUri: imageUrl,
          productId: docRef.id,
        };
        const resp = await fetch(`${API_BASE_URL}/api/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await resp.json();
        if (json.ok) {
          console.log('Marketplace submission:', json);
        }
      } catch (apiErr) {
        console.warn('Marketplace API call failed:', apiErr);
      }

      // Reset form
      setTitle('');
      setDesc('');
      setPrice('');
      setQuantity('1');
      setImageUri(null);
      setCroppedImageBase64(null);
      setShowPublish(false);

      Alert.alert(
        'Success!',
        'Product published successfully! It will appear in your dashboard and the marketplace.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push('/(tabs)');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Publish error:', err);
      Alert.alert('Publish failed', err.message || 'Unable to publish product. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Card style={styles.headerCard}>
        <Text style={styles.headerTitle}>👤 Profile</Text>
        <Text style={styles.headerSubtitle}>{auth.currentUser?.email || ''}</Text>
      </Card>

      {/* Personal Information Section */}
      <Card style={styles.sectionCard}>
        <Button
          mode="text"
          onPress={() => setShowPersonalInfo(!showPersonalInfo)}
          style={styles.sectionHeader}
          icon={showPersonalInfo ? "chevron-up" : "chevron-down"}
        >
          <Text style={styles.sectionTitle}>Personal Information</Text>
        </Button>
        
        {showPersonalInfo && (
          <View style={styles.sectionContent}>
            <TextInput 
              label="Full Name" 
              value={name} 
              onChangeText={setName} 
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput 
              label="Location" 
              value={location} 
              onChangeText={setLocation} 
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput 
              label="Phone Number" 
              value={phone} 
              onChangeText={setPhone} 
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput 
              label="Address" 
              value={address} 
              onChangeText={setAddress} 
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <Button 
              mode="contained" 
              onPress={saveProfile} 
              style={styles.saveButton}
              loading={saving}
              disabled={saving}
              buttonColor={colors.primary}
            >
              Save Personal Info
            </Button>
          </View>
        )}
      </Card>

      {/* Publish Product Section */}
      <Card style={styles.sectionCard}>
        <Button
          mode="text"
          onPress={togglePublish}
          style={styles.sectionHeader}
          icon={showPublish ? "chevron-up" : "chevron-down"}
        >
          <Text style={styles.sectionTitle}>Publish Product</Text>
        </Button>
        
        {showPublish && (
          <View style={styles.sectionContent}>
            <TextInput 
              label="Product Title" 
              value={title} 
              onChangeText={setTitle} 
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            
            <TextInput 
              label="Description" 
              value={desc} 
              onChangeText={setDesc} 
              multiline 
              numberOfLines={4} 
              mode="outlined" 
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            
            <View style={styles.priceRow}>
              <View style={styles.priceInputContainer}>
                <TextInput 
                  label="Price (₹)" 
                  value={price} 
                  onChangeText={setPrice} 
                  keyboardType="numeric" 
                  mode="outlined"
                  style={styles.priceInput}
                  left={<TextInput.Icon icon="currency-inr" />}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                />
              </View>
              <View style={styles.quantityInputContainer}>
                <TextInput 
                  label="Quantity" 
                  value={quantity} 
                  onChangeText={setQuantity} 
                  keyboardType="numeric" 
                  mode="outlined"
                  style={styles.quantityInput}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                />
              </View>
            </View>

            <Button 
              mode="outlined" 
              onPress={pickImage} 
              style={styles.imageButton}
              icon="image-plus"
              textColor={colors.primary}
            >
              {imageUri ? 'Change Image' : 'Pick Product Image'}
            </Button>
            
            {imageUri ? (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: imageUri }} 
                  style={styles.image} 
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>📷</Text>
                <Text style={styles.imagePlaceholderLabel}>No image selected</Text>
              </View>
            )}

            <Button 
              mode="contained" 
              onPress={cropImage} 
              style={styles.actionButton}
              loading={isEnhancing}
              disabled={isEnhancing}
              buttonColor={colors.secondary}
              icon="crop"
            >
              Enhance Image
            </Button>

            <Button 
              mode="contained" 
              onPress={generateProductInfo} 
              style={styles.actionButton}
              loading={isGenerating}
              disabled={isGenerating}
              buttonColor={colors.accent}
              textColor={colors.textPrimary}
              icon="auto-fix"
            >
              Generate with AI
            </Button>

            <Button 
              mode="contained" 
              onPress={publish} 
              style={[styles.actionButton, styles.publishButton]}
              loading={isPublishing}
              disabled={isPublishing || !title || !desc || !imageUri}
              buttonColor={colors.primary}
              icon="publish"
            >
              Publish Product to Marketplace
            </Button>
          </View>
        )}
      </Card>

      {/* Logout Button */}
      <Button 
        mode="outlined" 
        onPress={onLogout} 
        style={styles.logoutButton}
        textColor={colors.error}
        icon="logout"
      >
        Logout
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.surface,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.surface,
    opacity: 0.9,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  sectionHeader: {
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    padding: spacing.md,
    paddingTop: 0,
    overflow: 'hidden',
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  priceInputContainer: {
    flex: 2,
  },
  priceInput: {
    backgroundColor: colors.surface,
  },
  quantityInputContainer: {
    flex: 1,
  },
  quantityInput: {
    backgroundColor: colors.surface,
  },
  saveButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  imageButton: {
    marginBottom: spacing.md,
    borderColor: colors.primary,
  },
  imageContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  imagePlaceholderText: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  imagePlaceholderLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actionButton: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  publishButton: {
    marginTop: spacing.sm,
  },
  logoutButton: {
    marginTop: spacing.md,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
  },
});
