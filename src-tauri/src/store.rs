use crate::item::Item;
use rusqlite::{params, Connection};

pub fn open(path: &str) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            source TEXT NOT NULL,
            source_detail TEXT,
            version TEXT,
            exec_path TEXT,
            homepage TEXT,
            raw_desc TEXT,
            installed_on_request INTEGER
        );",
    )?;
    Ok(conn)
}

/// Full rebuild: clear then insert. Inventory is disposable.
pub fn rebuild(conn: &Connection, items: &[Item]) -> Result<usize, rusqlite::Error> {
    conn.execute("DELETE FROM items", [])?;
    let mut stmt = conn.prepare(
        "INSERT INTO items (id,name,source,source_detail,version,exec_path,homepage,raw_desc,installed_on_request)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
    )?;
    for it in items {
        stmt.execute(params![
            it.id,
            it.name,
            it.source,
            it.source_detail,
            it.version,
            it.exec_path,
            it.homepage,
            it.raw_desc,
            it.installed_on_request.map(|b| b as i64)
        ])?;
    }
    Ok(items.len())
}

pub fn query_all(conn: &Connection) -> Result<Vec<Item>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id,name,source,source_detail,version,exec_path,homepage,raw_desc,installed_on_request
         FROM items ORDER BY name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Item {
            id: r.get(0)?,
            name: r.get(1)?,
            source: r.get(2)?,
            source_detail: r.get(3)?,
            version: r.get(4)?,
            exec_path: r.get(5)?,
            homepage: r.get(6)?,
            raw_desc: r.get(7)?,
            installed_on_request: r.get::<_, Option<i64>>(8)?.map(|i| i != 0),
        })
    })?;
    rows.collect()
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Item>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id,name,source,source_detail,version,exec_path,homepage,raw_desc,installed_on_request
         FROM items WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map([id], |r| {
        Ok(Item {
            id: r.get(0)?,
            name: r.get(1)?,
            source: r.get(2)?,
            source_detail: r.get(3)?,
            version: r.get(4)?,
            exec_path: r.get(5)?,
            homepage: r.get(6)?,
            raw_desc: r.get(7)?,
            installed_on_request: r.get::<_, Option<i64>>(8)?.map(|i| i != 0),
        })
    })?;
    rows.next().transpose()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Item {
        Item {
            id: "brew:eza".into(),
            name: "eza".into(),
            source: "brew".into(),
            source_detail: None,
            version: Some("0.23.4".into()),
            exec_path: None,
            homepage: None,
            raw_desc: Some("modern ls".into()),
            installed_on_request: Some(true),
        }
    }

    #[test]
    fn rebuild_then_query_roundtrips() {
        let conn = open(":memory:").unwrap();
        let n = rebuild(&conn, &[sample()]).unwrap();
        assert_eq!(n, 1);
        let got = query_all(&conn).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0], sample());
    }

    #[test]
    fn rebuild_is_idempotent_not_appending() {
        let conn = open(":memory:").unwrap();
        rebuild(&conn, &[sample()]).unwrap();
        rebuild(&conn, &[sample()]).unwrap();
        assert_eq!(query_all(&conn).unwrap().len(), 1);
    }

    #[test]
    fn get_returns_one_or_none() {
        let conn = open(":memory:").unwrap();
        rebuild(&conn, &[sample()]).unwrap();
        assert!(get(&conn, "brew:eza").unwrap().is_some());
        assert!(get(&conn, "nope:x").unwrap().is_none());
    }
}
