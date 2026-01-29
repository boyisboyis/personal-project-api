import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-firebase-jwt';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  private defaultApp: any;

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });

    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Firebase configuration is incomplete. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your environment variables.');
      }

      this.defaultApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
        projectId: projectId, // เพิ่ม projectId ที่ root level ด้วย
      });
    } else {
      this.defaultApp = admin.app();
    }
  }

  async validate(token: string) {
    try {
      const firebaseUser = await this.defaultApp.auth().verifyIdToken(token, true);
      
      if (!firebaseUser) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.name,
        picture: firebaseUser.picture,
      };
    } catch (error) {
      throw new UnauthorizedException('Token validation failed');
    }
  }
}