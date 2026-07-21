const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const { getAuthCookieOptions } = require('../utils/cookieOptions');
const generateToken = require('../utils/generateToken');

const impersonateUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ message: 'A structured Audit Reason is legally required to impersonate heavily.' });
        }

        const impersonator = req.user;

        // Security Lock: Only SUPER_ADMIN can initiate an impersonation chain.
        if (impersonator.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Security Exception: Impersonation restricted to SUPER_ADMIN bounds.' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

        if (!targetUser) {
            return res.status(404).json({ message: 'Target profile missing from node.' });
        }

        if (targetUser.role === 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Security Exception: You cannot impersonate another SUPER_ADMIN globally.' });
        }

        // Implicitly log the extreme action inside AuditLog
        await prisma.auditLog.create({
            data: {
                adminId: impersonator.id,
                action: 'IMPERSONATE_USER',
                resourceId: targetUser.id,
                newValue: { targetEmail: targetUser.email, reason }
            }
        });

        // Generate Transient Impersonation JWT
        const token = jwt.sign(
            { 
                userId: targetUser.id, 
                tokenVersion: targetUser.tokenVersion,
                isImpersonating: true,
                impersonatorId: impersonator.id
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '2h' } // Hard-kill impersonation sessions within 120 minutes natively
        );

        res.cookie('jwt', token, { ...getAuthCookieOptions() });
        res.status(200).json({ message: `Securely assumed abstraction over ${targetUser.email}` });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Hard fault initiating impersonation chain.' });
    }
};

const revertImpersonation = async (req, res) => {
    try {
        // Since the current acting user is the 'impersonatorId', we extract it natively from our patched middleware
        if (!req.user.isImpersonating || !req.user.impersonatorId) {
            return res.status(400).json({ message: 'No active abstraction chain detected natively.' });
        }

        const admin = await prisma.user.findUnique({ where: { id: req.user.impersonatorId } });

        if (!admin) {
            res.cookie('jwt', '', { maxAge: 0, httpOnly: true }); // Hard kill
            return res.status(401).json({ message: 'Administrator array corrupted. Session terminated fully.' });
        }

        await prisma.auditLog.create({
            data: {
                adminId: admin.id,
                action: 'REVERT_IMPERSONATION',
                resourceId: req.user.id,
                newValue: { targetEmail: req.user.email }
            }
        });

        generateToken(res, admin.id, admin.tokenVersion);
        res.status(200).json({ message: 'Restored explicit SUPER_ADMIN constraints successfully.' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Hard fault resolving abstraction chain natively.' });
    }
};

module.exports = {
   impersonateUser,
   revertImpersonation
};
