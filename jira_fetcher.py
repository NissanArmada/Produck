#!/usr/bin/env python3
"""Simple Jira issues fetcher.

Usage example:
    python jira_fetcher.py --domain your-domain.atlassian.net --email you@example.com --api-token ABC123 --max-issues-per-project 5

It will list all accessible projects then fetch up to N issues per project.

Environment variable fallbacks:
    JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN

"""
from __future__ import annotations
import os
import sys
import argparse
import time
from typing import List, Dict, Any, Optional
import requests

DEFAULT_TIMEOUT = 15  # seconds
ISSUES_PAGE_SIZE = 50

class JiraClient:
    def __init__(self, domain: str, email: str, api_token: str, timeout: int = DEFAULT_TIMEOUT):
        if not domain.startswith('http'):
            domain = f"https://{domain}"  # allow passing bare domain
        self.base = domain.rstrip('/')
        self.email = email
        self.api_token = api_token
        self.timeout = timeout
        self.session = requests.Session()
        self.session.auth = (self.email, self.api_token)
        self.session.headers.update({"Accept": "application/json"})

    def _url(self, path: str) -> str:
        return f"{self.base}{path}" if path.startswith('/') else f"{self.base}/{path}"

    def get_projects(self) -> List[Dict[str, Any]]:
        # Using v2 API: /rest/api/2/project/search for pagination
        url = self._url('/rest/api/3/project/search')
        start_at = 0
        projects: List[Dict[str, Any]] = []
        while True:
            params = {"startAt": start_at, "maxResults": 50}
            resp = self.session.get(url, params=params, timeout=self.timeout)
            if resp.status_code == 401:
                raise SystemExit("Authentication failed: check email/api token.")
            resp.raise_for_status()
            data = resp.json()
            values = data.get('values', [])
            projects.extend(values)
            if start_at + data.get('maxResults', 0) >= data.get('total', 0):
                break
            start_at += data.get('maxResults', 0)
        return projects

    def get_issues_for_project(self, project_key: str, limit: int) -> List[Dict[str, Any]]:
        issues: List[Dict[str, Any]] = []
        start_at = 0
        jql = f'project={project_key} ORDER BY created DESC'
        url = self._url('/rest/api/3/search/jql')
        while len(issues) < limit:
            remaining = limit - len(issues)
            max_results = min(ISSUES_PAGE_SIZE, remaining)
            params = {
                "jql": jql,
                "startAt": start_at,
                "maxResults": max_results,
                "fields": "summary,status,assignee,created"  # reduce payload
            }
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            issues.extend(data.get('issues', []))
            if start_at + data.get('maxResults', 0) >= data.get('total', 0):
                break
            start_at += data.get('maxResults', 0)
        return issues


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch Jira projects and issues.")
    parser.add_argument('--domain', default=os.getenv('JIRA_DOMAIN'), required=os.getenv('JIRA_DOMAIN') is None, help='Jira domain e.g. yourcompany.atlassian.net')
    parser.add_argument('--email', default=os.getenv('JIRA_EMAIL'), required=os.getenv('JIRA_EMAIL') is None, help='Account email')
    parser.add_argument('--api-token', default=os.getenv('JIRA_API_TOKEN'), required=os.getenv('JIRA_API_TOKEN') is None, help='Jira API token')
    parser.add_argument('--project', help='Optional single project key to limit fetching')
    parser.add_argument('--max-issues-per-project', type=int, default=10, help='Limit of issues per project (default 10)')
    parser.add_argument('--timeout', type=int, default=DEFAULT_TIMEOUT, help='HTTP timeout seconds (default 15)')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    client = JiraClient(args.domain, args.email, args.api_token, timeout=args.timeout)

    if args.verbose:
        print(f"Connecting to {client.base} as {client.email}")

    try:
        projects = client.get_projects()
    except requests.HTTPError as e:
        print(f"Failed to fetch projects: {e}", file=sys.stderr)
        return 1

    if not projects:
        print("No projects found or insufficient permissions.")
        return 0

    if args.project:
        projects = [p for p in projects if p.get('key') == args.project]
        if not projects:
            print(f"Project key {args.project} not found.")
            return 1

    print(f"Found {len(projects)} project(s).")
    for p in projects:
        key = p.get('key')
        name = p.get('name')
        print(f"\n=== Project {key} - {name} ===")
        try:
            issues = client.get_issues_for_project(key, args.max_issues_per_project)
        except requests.HTTPError as e:
            print(f"Error fetching issues for {key}: {e}")
            continue
        if not issues:
            print("(No issues returned)")
            continue
        for issue in issues:
            iid = issue.get('key')
            fields = issue.get('fields', {})
            summary = fields.get('summary')
            status = fields.get('status', {}).get('name')
            assignee = (fields.get('assignee') or {}).get('displayName', 'Unassigned')
            created = fields.get('created')
            print(f"- {iid} | {status} | {assignee} | {created} | {summary}")
        time.sleep(0.2)  # small delay to be polite

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
