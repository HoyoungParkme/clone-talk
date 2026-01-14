/**
 * 모듈명: backend.server.storage
 * 설명: 사용자 저장소 인터페이스 및 메모리 구현
 *
 * 주요 기능:
 * - 사용자 조회/생성 인터페이스 정의
 * - 메모리 기반 저장소 구현
 *
 * 의존성:
 * - crypto: UUID 생성
 * - zod 스키마 타입: 사용자 타입 정의
 */

// 1. 표준 라이브러리
import { randomUUID } from "crypto";

// 2. 로컬 애플리케이션
import { type User, type InsertUser } from "@shared/schema";

// 필요에 따라 CRUD 메서드를 추가하세요

export interface IStorage {
  /**
   * 사용자 ID로 조회합니다.
   */
  getUser(id: string): Promise<User | undefined>;
  /**
   * 사용자 이름으로 조회합니다.
   */
  getUserByUsername(username: string): Promise<User | undefined>;
  /**
   * 사용자를 생성합니다.
   */
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  /**
   * 메모리 저장소를 초기화합니다.
   */
  constructor() {
    this.users = new Map();
  }

  /**
   * 사용자 ID로 조회합니다.
   */
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * 사용자 이름으로 조회합니다.
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  /**
   * 사용자를 생성합니다.
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();
