export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      decks: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_deck_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_deck_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_deck_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cards: {
        Row: {
          id: string
          user_id: string
          deck_id: string
          front: string
          back: string
          state: string
          due_at: string
          interval_days: number
          ease: number
          reps: number
          lapses: number
          learning_step_index: number
          suspended: boolean
          last_reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          deck_id: string
          front: string
          back: string
          state?: string
          due_at?: string
          interval_days?: number
          ease?: number
          reps?: number
          lapses?: number
          learning_step_index?: number
          suspended?: boolean
          last_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          deck_id?: string
          front?: string
          back?: string
          state?: string
          due_at?: string
          interval_days?: number
          ease?: number
          reps?: number
          lapses?: number
          learning_step_index?: number
          suspended?: boolean
          last_reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          card_id: string
          deck_id: string
          rating: string
          reviewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          deck_id: string
          rating: string
          reviewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          deck_id?: string
          rating?: string
          reviewed_at?: string
        }
      }
      imports: {
        Row: {
          id: string
          user_id: string
          deck_id: string | null
          filename: string
          file_type: string
          text: string
          page_count: number | null
          ocr_confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          deck_id?: string | null
          filename: string
          file_type: string
          text: string
          page_count?: number | null
          ocr_confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          deck_id?: string | null
          filename?: string
          file_type?: string
          text?: string
          page_count?: number | null
          ocr_confidence?: number | null
          created_at?: string
        }
      }
      generated_cards: {
        Row: {
          id: string
          user_id: string
          import_id: string
          deck_id: string
          front: string
          back: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          import_id: string
          deck_id: string
          front: string
          back: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          import_id?: string
          deck_id?: string
          front?: string
          back?: string
          created_at?: string
        }
      }
      settings: {
        Row: {
          user_id: string
          new_cards_per_day: number
          max_reviews_per_day: number
          learning_mode: string
          again_delay_minutes: number
          review_order: string
          learning_steps: string
          relearning_steps: string
          graduating_interval_days: number
          easy_interval_days: number
          starting_ease: number
          easy_bonus: number
          hard_interval: number
          interval_modifier: number
          new_interval_multiplier: number
          minimum_interval_days: number
          maximum_interval_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          new_cards_per_day?: number
          max_reviews_per_day?: number
          learning_mode?: string
          again_delay_minutes?: number
          review_order?: string
          learning_steps?: string
          relearning_steps?: string
          graduating_interval_days?: number
          easy_interval_days?: number
          starting_ease?: number
          easy_bonus?: number
          hard_interval?: number
          interval_modifier?: number
          new_interval_multiplier?: number
          minimum_interval_days?: number
          maximum_interval_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          new_cards_per_day?: number
          max_reviews_per_day?: number
          learning_mode?: string
          again_delay_minutes?: number
          review_order?: string
          learning_steps?: string
          relearning_steps?: string
          graduating_interval_days?: number
          easy_interval_days?: number
          starting_ease?: number
          easy_bonus?: number
          hard_interval?: number
          interval_modifier?: number
          new_interval_multiplier?: number
          minimum_interval_days?: number
          maximum_interval_days?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
