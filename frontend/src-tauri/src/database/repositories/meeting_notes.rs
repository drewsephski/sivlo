use crate::database::models::MeetingNotes;
use chrono::Utc;
use sqlx::SqlitePool;
use tracing::info;

pub struct MeetingNotesRepository;

impl MeetingNotesRepository {
    /// Retrieve persisted notes for a meeting.
    ///
    /// Returns `None` when the meeting has no notes row yet (missing notes are
    /// distinguishable from an existing-but-empty document).
    pub async fn get_notes(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Option<MeetingNotes>, sqlx::Error> {
        sqlx::query_as::<_, MeetingNotes>("SELECT * FROM meeting_notes WHERE meeting_id = ?")
            .bind(meeting_id)
            .fetch_optional(pool)
            .await
    }

    /// Insert or update the notes row for a meeting.
    ///
    /// First save inserts a row; later saves update the same row (upsert on the
    /// `meeting_id` primary key). `created_at` is preserved across updates.
    ///
    /// Errors with `sqlx::Error::RowNotFound` when the meeting does not exist.
    pub async fn save_notes(
        pool: &SqlitePool,
        meeting_id: &str,
        notes_markdown: &str,
        notes_json: &str,
    ) -> Result<MeetingNotes, sqlx::Error> {
        let mut transaction = pool.begin().await?;

        let meeting_exists = sqlx::query("SELECT 1 FROM meetings WHERE id = ?")
            .bind(meeting_id)
            .fetch_optional(&mut *transaction)
            .await?
            .is_some();

        if !meeting_exists {
            info!("Attempted to save notes for a non-existent meeting_id: {}", meeting_id);
            transaction.rollback().await?;
            return Err(sqlx::Error::RowNotFound);
        }

        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO meeting_notes (meeting_id, notes_markdown, notes_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(meeting_id) DO UPDATE SET
                notes_markdown = excluded.notes_markdown,
                notes_json = excluded.notes_json,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(meeting_id)
        .bind(notes_markdown)
        .bind(notes_json)
        .bind(now)
        .bind(now)
        .execute(&mut *transaction)
        .await?;

        let saved = sqlx::query_as::<_, MeetingNotes>("SELECT * FROM meeting_notes WHERE meeting_id = ?")
            .bind(meeting_id)
            .fetch_one(&mut *transaction)
            .await?;

        transaction.commit().await?;

        info!("Saved notes for meeting_id: {}", meeting_id);
        Ok(saved)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;

    async fn test_db_pool() -> SqlitePool {
        let options = SqliteConnectOptions::new()
            .filename(":memory:")
            .create_if_missing(true);
        let pool = sqlx::pool::PoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("failed to create test database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("failed to run migrations");
        pool
    }

    async fn seed_meeting(pool: &SqlitePool, meeting_id: &str) {
        let now = Utc::now();
        sqlx::query("INSERT INTO meetings (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .bind(meeting_id)
            .bind("Existing Meeting")
            .bind(now)
            .bind(now)
            .execute(pool)
            .await
            .expect("failed to insert meeting");
    }

    async fn notes_row_count(pool: &SqlitePool, meeting_id: &str) -> i64 {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM meeting_notes WHERE meeting_id = ?")
            .bind(meeting_id)
            .fetch_one(pool)
            .await
            .expect("failed to count notes rows");
        count
    }

    const SAMPLE_JSON: &str = r#"[{"id":"block-1","type":"paragraph","props":{},"content":["Hello"]}]"#;

    #[tokio::test]
    async fn get_notes_returns_none_when_meeting_has_no_notes() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "meeting-no-notes").await;

        let notes = MeetingNotesRepository::get_notes(&pool, "meeting-no-notes")
            .await
            .expect("get_notes should not error");

        assert!(notes.is_none());
    }

    #[tokio::test]
    async fn save_notes_round_trips_markdown_and_json() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "meeting-roundtrip").await;

        MeetingNotesRepository::save_notes(&pool, "meeting-roundtrip", "# Notes", SAMPLE_JSON)
            .await
            .expect("save_notes should succeed");

        let notes = MeetingNotesRepository::get_notes(&pool, "meeting-roundtrip")
            .await
            .expect("get_notes should succeed")
            .expect("notes should exist after save");

        assert_eq!(notes.meeting_id, "meeting-roundtrip");
        assert_eq!(notes.notes_markdown.as_deref(), Some("# Notes"));
        assert_eq!(notes.notes_json.as_deref(), Some(SAMPLE_JSON));
    }

    #[tokio::test]
    async fn save_twice_updates_same_row_not_duplicates() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "meeting-update").await;

        MeetingNotesRepository::save_notes(&pool, "meeting-update", "v1", SAMPLE_JSON)
            .await
            .expect("first save should succeed");
        MeetingNotesRepository::save_notes(&pool, "meeting-update", "v2", r#"[]"#)
            .await
            .expect("second save should succeed");

        let notes = MeetingNotesRepository::get_notes(&pool, "meeting-update")
            .await
            .expect("get_notes should succeed")
            .expect("notes should exist after save");

        assert_eq!(notes.notes_markdown.as_deref(), Some("v2"));
        assert_eq!(notes.notes_json.as_deref(), Some(r#"[]"#));

        assert_eq!(notes_row_count(&pool, "meeting-update").await, 1);
    }

    #[tokio::test]
    async fn deleting_meeting_cascades_notes() {
        let pool = test_db_pool().await;
        seed_meeting(&pool, "meeting-cascade").await;

        MeetingNotesRepository::save_notes(&pool, "meeting-cascade", "notes", SAMPLE_JSON)
            .await
            .expect("save_notes should succeed");

        sqlx::query("DELETE FROM meetings WHERE id = ?")
            .bind("meeting-cascade")
            .execute(&pool)
            .await
            .expect("failed to delete meeting");

        assert_eq!(notes_row_count(&pool, "meeting-cascade").await, 0);
    }
}
