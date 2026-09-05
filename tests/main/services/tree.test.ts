import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestProjectDir } from '../../helpers/project-fixture';
import { isSqliteAvailable } from '../../helpers/sqlite-available';
import { closeProject } from '@main/services/project';
import { createPerson } from '@main/services/people';
import { addChildToPerson, addPartner } from '@main/services/family';
import { getTree } from '@main/services/tree';

vi.mock('@main/services/settings', () => ({
  getDeviceMeta: () => ({ deviceId: 'test-device', label: 'tester' }),
  getSettings: () => ({
    deviceId: 'test-device',
    editorLabel: '',
    backupOnQuit: false,
    backupKeepCount: 10,
    recentProjects: []
  }),
  addRecentProject: vi.fn(),
  pruneRecentProjects: vi.fn()
}));

describe.skipIf(!isSqliteAvailable())('tree service', () => {
  afterEach(() => {
    closeProject();
  });

  it('returns an empty tree for a project without people', async () => {
    const project = createTestProjectDir();
    try {
      const tree = await getTree();
      expect(tree).toEqual({ nodes: [], edges: [], families: [], focusPersonId: null });
    } finally {
      project.cleanup();
    }
  });

  it('builds nodes, edges and focus for a small family', async () => {
    const project = createTestProjectDir();
    try {
      const parent = await createPerson({ firstName: 'Parent', lastName: 'Tree' });
      const partner = await addPartner(parent.id, { firstName: 'Partner', lastName: 'Tree' });
      const child = await addChildToPerson(parent.id, { firstName: 'Child', lastName: 'Tree' });

      const tree = await getTree(parent.id);

      expect(tree.focusPersonId).toBe(parent.id);
      expect(tree.nodes.map((n) => n.id).sort()).toEqual([parent.id, partner.id, child.id].sort());
      expect(tree.edges.some((e) => e.kind === 'partner' && e.source === parent.id && e.target === partner.id)).toBe(true);
      expect(tree.edges.some((e) => e.kind === 'parent' && e.source === parent.id && e.target === child.id)).toBe(true);
      expect(tree.families).toHaveLength(1);
      expect(tree.families[0].partners.sort()).toEqual([parent.id, partner.id].sort());
      expect(tree.families[0].children).toContain(child.id);

      const focusNode = tree.nodes.find((n) => n.id === parent.id);
      expect(focusNode?.type).toBe('focus');
    } finally {
      project.cleanup();
    }
  });

  it('picks a default focus when opened without a selected person', async () => {
    const project = createTestProjectDir();
    try {
      const parent = await createPerson({ firstName: 'Parent', lastName: 'Root' });
      await addChildToPerson(parent.id, { firstName: 'Child', lastName: 'Root' });

      const tree = await getTree();
      expect(tree.focusPersonId).toBe(parent.id);
      expect(tree.nodes.length).toBe(2);
    } finally {
      project.cleanup();
    }
  });
});
