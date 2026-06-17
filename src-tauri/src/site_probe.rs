use serde::Serialize;
use std::{
    net::{TcpStream, ToSocketAddrs},
    time::Duration,
};
use tauri::async_runtime;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteAvailabilityResult {
    pub label: String,
    pub available: bool,
    pub message: String,
}

pub async fn probe_sites<'a, I>(targets: I, timeout: Duration) -> Vec<SiteAvailabilityResult>
where
    I: IntoIterator<Item = (&'a str, &'a str)>,
{
    let handles: Vec<_> = targets
        .into_iter()
        .map(|(label, url)| {
            let label = label.to_string();
            let url = url.to_string();
            async_runtime::spawn_blocking(move || probe_site(&label, &url, timeout))
        })
        .collect();

    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        match handle.await {
            Ok(result) => results.push(result),
            Err(_error) => results.push(SiteAvailabilityResult {
                label: String::new(),
                available: false,
                message: "不可访问".to_string(),
            }),
        }
    }
    results
}

pub fn probe_site(label: &str, target: &str, timeout: Duration) -> SiteAvailabilityResult {
    SiteAvailabilityResult {
        label: label.to_string(),
        available: is_site_available(target, timeout),
        message: String::new(),
    }
    .with_fallback_message("不可访问")
}

pub fn is_site_available(target: &str, timeout: Duration) -> bool {
    let parsed = match Url::parse(target) {
        Ok(url) => url,
        Err(_) => return false,
    };

    let host = match parsed.host_str() {
        Some(host) => host,
        None => return false,
    };

    let port = parsed
        .port_or_known_default()
        .unwrap_or(if parsed.scheme() == "http" { 80 } else { 443 });

    match (host, port).to_socket_addrs() {
        Ok(addresses) => addresses
            .into_iter()
            .any(|address| TcpStream::connect_timeout(&address, timeout).is_ok()),
        Err(_) => false,
    }
}

trait AvailabilityMessageExt {
    fn with_fallback_message(self, fallback: &str) -> Self;
}

impl AvailabilityMessageExt for SiteAvailabilityResult {
    fn with_fallback_message(mut self, fallback: &str) -> Self {
        if !self.available && self.message.is_empty() {
            self.message = fallback.to_string();
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{net::TcpListener, thread};

    fn local_http_url(port: u16) -> String {
        format!("http://127.0.0.1:{port}/health")
    }

    #[test]
    fn probe_site_returns_unavailable_for_invalid_url() {
        let result = probe_site("broken", "not-a-url", Duration::from_millis(50));
        assert_eq!(
            result,
            SiteAvailabilityResult {
                label: "broken".to_string(),
                available: false,
                message: "不可访问".to_string(),
            }
        );
    }

    #[test]
    fn probe_site_treats_open_tcp_port_as_available() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let port = listener.local_addr().expect("listener addr").port();

        let server = thread::spawn(move || {
            let _ = listener.accept();
        });

        let result = probe_site("local", &local_http_url(port), Duration::from_millis(200));
        assert!(result.available);
        assert_eq!(result.message, "");

        server.join().expect("server thread");
    }

    #[test]
    fn probe_site_treats_closed_port_as_unavailable() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind temp listener");
        let port = listener.local_addr().expect("listener addr").port();
        drop(listener);

        let result = probe_site("closed", &local_http_url(port), Duration::from_millis(100));
        assert!(!result.available);
        assert_eq!(result.message, "不可访问");
    }
}
