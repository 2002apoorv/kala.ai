import React, { useEffect, useState } from 'react';
import { View, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  imageUri: string;
  status: string;
  createdAt: Timestamp | null;
  uid: string;
};

type ArtisanInfo = {
  name?: string;
  location?: string;
  email?: string;
};

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [artisanInfo, setArtisanInfo] = useState<ArtisanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;

      try {
        const productRef = doc(db, 'products', id);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          Alert.alert('Error', 'Product not found', [
            { text: 'OK', onPress: () => router.back() },
          ]);
          return;
        }

        const productData = { id: productSnap.id, ...productSnap.data() } as Product;
        setProduct(productData);

        // Check if current user is the owner
        const user = auth.currentUser;
        if (user && user.uid === productData.uid) {
          setIsOwner(true);
        }

        // Fetch artisan info
        try {
          const userRef = doc(db, 'users', productData.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setArtisanInfo(userSnap.data() as ArtisanInfo);
          }
        } catch (err) {
          console.error('Error fetching artisan info:', err);
        }
      } catch (err: any) {
        console.error('Error fetching product:', err);
        Alert.alert('Error', err.message || 'Unable to load product');
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();

    // Listen for auth changes
    const unsub = onAuthStateChanged(auth, (user) => {
      if (product && user && user.uid === product.uid) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
    });
    return unsub;
  }, [id, product?.uid]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text>Product not found</Text>
        <Button onPress={() => router.back()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      {product.imageUri && (
        <Image
          source={{ uri: product.imageUri }}
          style={{ width: '100%', height: 300, backgroundColor: '#f5f5f5' }}
          resizeMode="contain"
        />
      )}

      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
          {product.title}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1A73E8' }}>
            ₹{product.price}
          </Text>
          <Text style={{ fontSize: 14, color: '#666' }}>
            {product.quantity} available
          </Text>
        </View>

        <Card style={{ padding: 16, marginBottom: 16, backgroundColor: '#f9f9f9' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Product Description
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 22, color: '#333' }}>
            {product.description}
          </Text>
        </Card>

        {artisanInfo && (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Artisan Information
            </Text>
            {artisanInfo.name && (
              <Text style={{ fontSize: 14, marginBottom: 4 }}>
                <Text style={{ fontWeight: '600' }}>Name: </Text>
                {artisanInfo.name}
              </Text>
            )}
            {artisanInfo.location && (
              <Text style={{ fontSize: 14, marginBottom: 4 }}>
                <Text style={{ fontWeight: '600' }}>Location: </Text>
                {artisanInfo.location}
              </Text>
            )}
          </Card>
        )}

        {isOwner && (
          <Card style={{ padding: 16, marginBottom: 16, backgroundColor: '#e3f2fd' }}>
            <Text style={{ fontSize: 14, color: '#1976d2' }}>
              This is your product
            </Text>
          </Card>
        )}

        {!isOwner && (
          <Button
            mode="contained"
            onPress={() => {
              Alert.alert('Contact Artisan', 'This feature will allow customers to contact the artisan directly.');
            }}
            style={{ marginTop: 16 }}
          >
            Contact Artisan
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

